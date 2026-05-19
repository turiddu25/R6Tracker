import { getRedis } from "@/lib/redis";
import type { IngestMatchSummary, MatchIngestPayload, StoredMatchSummary } from "@/lib/matchTypes";

const latestMatchesKey = "r6:matches:latest";
const seasonMatchesKey = (seasonKey: string) => `r6:matches:${seasonKey}`;
const latestLimit = 100;
const seasonLimit = 500;

export async function getStoredMatches(seasonKey?: string) {
  const redis = getRedis();

  if (!redis) {
    return [];
  }

  if (seasonKey) {
    return filterRanked((await redis.get<StoredMatchSummary[]>(seasonMatchesKey(seasonKey))) ?? []);
  }

  return filterRanked((await redis.get<StoredMatchSummary[]>(latestMatchesKey)) ?? []);
}

export async function ingestMatches(payload: MatchIngestPayload) {
  const redis = getRedis();

  if (!redis) {
    throw new Error("Upstash Redis is not configured.");
  }

  const ingestedAt = new Date().toISOString();
  const rankedMatches = payload.matches.filter(isRankedMatch);
  const stored = rankedMatches.map((match) => toStoredMatch(match, payload, ingestedAt));
  const seasonKeys = [...new Set(stored.map((match) => match.seasonKey))];

  const latest = await mergeMatchBucket(
    (await redis.get<StoredMatchSummary[]>(latestMatchesKey)) ?? [],
    stored,
    latestLimit,
  );

  await redis.set(latestMatchesKey, latest);

  for (const seasonKey of seasonKeys) {
    const key = seasonMatchesKey(seasonKey);
    const existing = (await redis.get<StoredMatchSummary[]>(key)) ?? [];
    const seasonMatches = stored.filter((match) => match.seasonKey === seasonKey);
    const merged = await mergeMatchBucket(existing, seasonMatches, seasonLimit);
    await redis.set(key, merged);
  }

  return {
    accepted: stored.length,
    seasonKeys,
    ingestedAt,
  };
}

function toStoredMatch(
  match: IngestMatchSummary,
  payload: MatchIngestPayload,
  ingestedAt: string,
): StoredMatchSummary {
  return {
    ...match,
    id: buildMatchId(match),
    scraperRunId: payload.scraperRunId,
    scrapedAt: payload.scrapedAt,
    ingestedAt,
  };
}

async function mergeMatchBucket(
  existing: StoredMatchSummary[],
  incoming: StoredMatchSummary[],
  limit: number,
) {
  const byId = new Map(existing.map((match) => [match.id, match]));

  for (const match of incoming) {
    byId.set(match.id, match);
  }

  return [...byId.values()]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

function buildMatchId(match: IngestMatchSummary) {
  if (match.sourceMatchId) {
    return `${match.source}:${match.sourceMatchId}`;
  }

  const players = match.players
    .map((player) => player.playerKey)
    .sort()
    .join("-");

  return [
    match.source,
    match.startedAt,
    match.map ?? "unknown-map",
    match.score ?? "unknown-score",
    players,
  ].join(":");
}

function isRankedMatch(match: IngestMatchSummary) {
  return (match.playlist ?? "").toLowerCase() === "ranked" || (match.mode ?? "").toLowerCase() === "ranked";
}

function filterRanked(matches: StoredMatchSummary[]) {
  return matches.filter(isRankedMatch);
}
