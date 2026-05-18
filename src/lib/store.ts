import { friends, refreshCooldownMinutes } from "@/config/friends";
import { getSeasonForDate } from "@/config/seasons";
import { fetchR6DataBundle } from "@/lib/r6data";
import { getRedis } from "@/lib/redis";
import type { NormalizedPlayerStats, PlayerSnapshot, SquadResponse } from "@/lib/types";
import { normalizePlayerStats } from "@/lib/normalize";

const latestKey = "r6:squad:latest";
const historyKey = "r6:squad:history";
const historyLimit = 200;

let memoryLatest: NormalizedPlayerStats[] = [];
let memoryHistory: PlayerSnapshot[] = [];
let memoryLastRefreshAt: string | null = null;

export async function getSquad(): Promise<SquadResponse> {
  const redis = getRedis();
  const warnings: string[] = [];

  if (!redis) {
    warnings.push("Upstash Redis is not configured. Showing in-memory data only.");
    return buildResponse(memoryLatest, memoryHistory, memoryLastRefreshAt, "empty", warnings);
  }

  try {
    const [players, history] = await Promise.all([
      redis.get<NormalizedPlayerStats[]>(latestKey),
      redis.lrange<PlayerSnapshot>(historyKey, 0, historyLimit - 1),
    ]);

    const latestPlayers = players ?? memoryLatest;
    const snapshots = normalizeSnapshots(history?.reverse() ?? memoryHistory);
    const lastUpdatedAt = newestFetchedAt(latestPlayers);

    return buildResponse(latestPlayers, snapshots, lastUpdatedAt, "redis", warnings);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
    return buildResponse(memoryLatest, memoryHistory, memoryLastRefreshAt, "empty", warnings);
  }
}

export async function refreshSquad(): Promise<{ squad: SquadResponse; status: number }> {
  const current = await getSquad();

  if (!current.canRefresh) {
    return { squad: current, status: 429 };
  }

  const fetchedAt = new Date().toISOString();
  const results = await Promise.allSettled(
    friends.map(async (friend) => {
      const bundle = await fetchR6DataBundle(friend);
      const normalized = normalizePlayerStats(friend, bundle, fetchedAt);
      return { friend, normalized, raw: bundle };
    }),
  );

  const warnings = current.warnings.slice();
  const refreshed = results
    .map((result) => {
      if (result.status === "rejected") {
        warnings.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
        return null;
      }

      return result.value;
    })
    .filter((result) => result !== null);

  if (refreshed.length === 0) {
    return {
      squad: {
        ...current,
        warnings: warnings.length > 0 ? warnings : ["No players refreshed."],
      },
      status: 502,
    };
  }

  const redis = getRedis();
  const players = refreshed.map(({ normalized }) => normalized);
  const history = players.map(toSnapshot);

  memoryLatest = mergeLatest(memoryLatest, players);
  memoryHistory = [...memoryHistory, ...history].slice(-historyLimit);
  memoryLastRefreshAt = fetchedAt;

  if (redis) {
    try {
      await Promise.all([
        redis.set(latestKey, memoryLatest),
        redis.lpush(historyKey, ...history),
        redis.ltrim(historyKey, 0, historyLimit - 1),
      ]);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  } else {
    warnings.push("Upstash Redis is not configured. Refreshed data was not persisted.");
  }

  return {
    squad: buildResponse(memoryLatest, memoryHistory, fetchedAt, redis ? "redis" : "live", warnings),
    status: 200,
  };
}

function buildResponse(
  players: NormalizedPlayerStats[],
  history: PlayerSnapshot[],
  lastUpdatedAt: string | null,
  source: SquadResponse["source"],
  warnings: string[],
): SquadResponse {
  const cooldownEndsAt = getCooldownEndsAt(lastUpdatedAt);
  const activeSeason = getSeasonForDate();
  const normalizedPlayers = normalizePlayers(players);
  const normalizedHistory = normalizeSnapshots(history);
  const activeHistory = normalizedHistory.filter(
    (snapshot) => snapshot.seasonKey === activeSeason.key,
  );

  return {
    players: sortLikeConfig(normalizedPlayers),
    history: activeHistory,
    canRefresh: cooldownEndsAt === null || Date.now() >= new Date(cooldownEndsAt).getTime(),
    cooldownEndsAt,
    lastUpdatedAt,
    activeSeasonKey: activeSeason.key,
    activeSeasonName: activeSeason.name,
    source,
    warnings,
  };
}

function getCooldownEndsAt(lastUpdatedAt: string | null) {
  if (!lastUpdatedAt) {
    return null;
  }

  return new Date(
    new Date(lastUpdatedAt).getTime() + refreshCooldownMinutes * 60 * 1000,
  ).toISOString();
}

function newestFetchedAt(players: NormalizedPlayerStats[]) {
  const timestamps = players
    .map((player) => new Date(player.fetchedAt).getTime())
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function toSnapshot(player: NormalizedPlayerStats): PlayerSnapshot {
  const season = getSeasonForDate(player.fetchedAt);

  return {
    playerKey: player.playerKey,
    fetchedAt: player.fetchedAt,
    seasonKey: player.seasonKey ?? season.key,
    seasonName: player.seasonName ?? season.name,
    kd: player.kd,
    winRate: player.winRate,
    rankPoints: player.rankPoints,
    matches: player.matches,
  };
}

function normalizePlayers(players: NormalizedPlayerStats[]) {
  return players.map((player) => {
    const season = getSeasonForDate(player.fetchedAt);

    return {
      ...player,
      seasonKey: player.seasonKey ?? season.key,
      seasonName: player.seasonName ?? season.name,
    };
  });
}

function normalizeSnapshots(history: PlayerSnapshot[]) {
  return history.map((snapshot) => {
    const season = getSeasonForDate(snapshot.fetchedAt);

    return {
      ...snapshot,
      seasonKey: snapshot.seasonKey ?? season.key,
      seasonName: snapshot.seasonName ?? season.name,
    };
  });
}

function mergeLatest(
  previous: NormalizedPlayerStats[],
  next: NormalizedPlayerStats[],
): NormalizedPlayerStats[] {
  const map = new Map(previous.map((player) => [player.playerKey, player]));

  for (const player of next) {
    map.set(player.playerKey, player);
  }

  return [...map.values()];
}

function sortLikeConfig(players: NormalizedPlayerStats[]) {
  const order = new Map(friends.map((friend, index) => [friend.key, index]));

  return players
    .slice()
    .sort((a, b) => (order.get(a.playerKey) ?? 999) - (order.get(b.playerKey) ?? 999));
}
