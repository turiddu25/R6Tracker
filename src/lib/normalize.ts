import type { FriendConfig, NormalizedPlayerStats, R6DataBundle } from "@/lib/types";
import { asNumber, round } from "@/lib/number";

type MatchCandidate = {
  score: number;
  data: Record<string, unknown>;
};

const metricAliases = {
  kd: ["kd", "killDeathRatio", "kdratio", "k/d", "pvp_kd"],
  winRate: ["winPercent", "winRate", "matchWinPercent", "winsPercent", "pvp_win_ratio"],
  matches: ["matchesPlayed", "matches", "roundsPlayed", "gamesPlayed"],
  wins: ["wins", "matchesWon"],
  losses: ["losses", "matchesLost"],
  kills: ["kills"],
  deaths: ["deaths"],
  assists: ["assists"],
  headshots: ["headshots", "headShots"],
  headshotRate: ["headshotPercent", "headshotRate", "headshotsPercent"],
  playtimeMs: ["timePlayedMs", "playtimeMs", "timePlayedMillis"],
  playtimeHours: ["playtimeHours", "hoursPlayed"],
  rankPoints: ["rankPoints", "rankedPoints", "mmr", "rp", "value"],
  peakRankPoints: ["maxRankPoints", "peakRankPoints", "maxMmr", "maxRankedPoints"],
};

export function normalizePlayerStats(
  friend: FriendConfig,
  bundle: R6DataBundle,
  fetchedAt = new Date().toISOString(),
): NormalizedPlayerStats {
  const statsCandidate = findBestStatsObject(bundle.stats);
  const seasonalCandidate = findBestRankObject(bundle.seasonalStats);
  const stats = statsCandidate?.data ?? {};
  const seasonal = seasonalCandidate?.data ?? {};

  const kills = pickNumber(stats, metricAliases.kills);
  const deaths = pickNumber(stats, metricAliases.deaths);
  const wins = pickNumber(stats, metricAliases.wins);
  const losses = pickNumber(stats, metricAliases.losses);
  const matchesFromApi = pickNumber(stats, metricAliases.matches);
  const headshots = pickNumber(stats, metricAliases.headshots);
  const playtimeMs = pickNumber(stats, metricAliases.playtimeMs);

  const kd = pickNumber(stats, metricAliases.kd) ?? ratio(kills, deaths);
  const matches = matchesFromApi ?? sum(wins, losses);
  const winRate =
    pickNumber(stats, metricAliases.winRate) ?? percentage(wins, matches ?? sum(wins, losses));
  const headshotRate =
    pickNumber(stats, metricAliases.headshotRate) ?? percentage(headshots, kills);
  const playtimeHours =
    pickNumber(stats, metricAliases.playtimeHours) ??
    (playtimeMs === null ? null : round(playtimeMs / 1000 / 60 / 60, 1));

  const seasonalMetadata = readObject(seasonal.metadata);
  const rank = readString(seasonalMetadata?.rank) ?? readString(stats.rank);
  const rankImageUrl =
    readString(seasonalMetadata?.imageUrl) ??
    readString(seasonalMetadata?.image) ??
    readString(stats.rankImageUrl);

  return {
    playerKey: friend.key,
    displayName: friend.displayName,
    username: friend.nameOnPlatform,
    platformType: friend.platformType,
    platformFamily: friend.platformFamily,
    accent: friend.accent,
    avatarUrl: friend.avatarUrl,
    fetchedAt,
    rank,
    rankImageUrl,
    rankPoints: pickNumber(seasonal, metricAliases.rankPoints) ?? pickNumber(stats, metricAliases.rankPoints),
    peakRankPoints:
      pickNumber(seasonal, metricAliases.peakRankPoints) ??
      pickNumber(stats, metricAliases.peakRankPoints),
    kd: round(kd),
    winRate: round(winRate, 1),
    matches,
    wins,
    losses,
    kills,
    deaths,
    assists: pickNumber(stats, metricAliases.assists),
    headshots,
    headshotRate: round(headshotRate, 1),
    playtimeHours,
    rawSummary: stats,
  };
}

function findBestStatsObject(data: unknown): MatchCandidate | null {
  const objects = collectObjects(data);
  let best: MatchCandidate | null = null;

  for (const object of objects) {
    const keys = new Set(Object.keys(object));
    const score =
      scoreAliases(keys, metricAliases.kd) * 4 +
      scoreAliases(keys, metricAliases.kills) * 3 +
      scoreAliases(keys, metricAliases.deaths) * 3 +
      scoreAliases(keys, metricAliases.matches) * 2 +
      scoreAliases(keys, metricAliases.winRate) * 2 +
      scoreAliases(keys, metricAliases.rankPoints);

    if (score > 0 && (!best || score > best.score)) {
      best = { score, data: object };
    }
  }

  return best;
}

function findBestRankObject(data: unknown): MatchCandidate | null {
  const objects = collectObjects(data);
  let best: MatchCandidate | null = null;

  for (const object of objects) {
    const keys = new Set(Object.keys(object));
    const metadata = readObject(object.metadata);
    const score =
      scoreAliases(keys, metricAliases.rankPoints) * 5 +
      scoreAliases(keys, metricAliases.peakRankPoints) * 3 +
      (metadata?.rank ? 3 : 0) +
      (metadata?.imageUrl ? 2 : 0);

    if (score > 0 && (!best || score > best.score)) {
      best = { score, data: object };
    }
  }

  return best;
}

function collectObjects(value: unknown, depth = 0, output: Record<string, unknown>[] = []) {
  if (depth > 8 || value === null || typeof value !== "object") {
    return output;
  }

  if (!Array.isArray(value)) {
    output.push(value as Record<string, unknown>);
  }

  for (const child of Object.values(value)) {
    collectObjects(child, depth + 1, output);
  }

  return output;
}

function scoreAliases(keys: Set<string>, aliases: string[]) {
  return aliases.some((alias) => keys.has(alias)) ? 1 : 0;
}

function pickNumber(source: Record<string, unknown>, aliases: string[]): number | null {
  for (const alias of aliases) {
    const direct = asNumber(source[alias]);
    if (direct !== null) {
      return direct;
    }

    const caseInsensitiveKey = Object.keys(source).find(
      (key) => key.toLowerCase() === alias.toLowerCase(),
    );
    if (caseInsensitiveKey) {
      const value = asNumber(source[caseInsensitiveKey]);
      if (value !== null) {
        return value;
      }
    }
  }

  return null;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function percentage(numerator: number | null, denominator: number | null): number | null {
  const value = ratio(numerator, denominator);
  return value === null ? null : value * 100;
}

function sum(left: number | null, right: number | null): number | null {
  if (left === null || right === null) {
    return null;
  }

  return left + right;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
