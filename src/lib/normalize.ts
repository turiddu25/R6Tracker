import type { FriendConfig, NormalizedPlayerStats, OperatorStat, R6DataBundle } from "@/lib/types";
import { asNumber, round } from "@/lib/number";
import { getSeasonForDate } from "@/config/seasons";

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
  const season = getSeasonForDate(fetchedAt);
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
    seasonKey: season.key,
    seasonName: season.name,
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
    operators: normalizeOperators(bundle.operatorStats),
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

function normalizeOperators(data: unknown): OperatorStat[] {
  const objects = collectObjects(data);
  const grouped = new Map<string, { score: number; data: OperatorStat }>();

  for (const object of objects) {
    const operator = pickText(object, ["operator", "name", "key"]) ?? pickText(object.metadata, [
      "name",
      "operator",
      "key",
      "displayName",
      "label",
    ]);

    if (!operator) {
      continue;
    }

    const side = pickText(object, ["side", "team"]) ?? pickText(object.metadata, ["side", "team"]);
    const roundsPlayed = pickNestedNumber(object, ["roundsPlayed", "rounds", "gamesPlayed"]);
    const matchesPlayed = pickNestedNumber(object, ["matchesPlayed", "matches"]);
    const matchesWon = pickNestedNumber(object, ["matchesWon", "wins"]);
    const matchesLost = pickNestedNumber(object, ["matchesLost", "losses"]);
    const winPercent = pickNestedNumber(object, ["winPercent", "winRate"]);
    const matchWinPercent = pickNestedNumber(object, ["matchWinPercent"]);
    const kd = pickNestedNumber(object, ["kd", "killDeathRatio"]);
    const kills = pickNestedNumber(object, ["kills"]);
    const deaths = pickNestedNumber(object, ["deaths"]);
    const assists = pickNestedNumber(object, ["assists"]);
    const headshotPercent = pickNestedNumber(object, ["headshotPercent", "headshotRate"]);
    const headshots = pickNestedNumber(object, ["headshots"]);
    const timePlayed = pickText(object, ["timePlayed", "time"]);
    const timePlayedMs = pickNestedNumber(object, ["timePlayedMs", "timePlayedMillis"]);
    const clutches = pickNestedNumber(object, ["clutches"]);
    const clutchesLost = pickNestedNumber(object, ["clutchesLost"]);
    const firstBloods = pickNestedNumber(object, ["firstBloods"]);
    const firstDeaths = pickNestedNumber(object, ["firstDeaths"]);
    const teamKills = pickNestedNumber(object, ["teamKills"]);

    const score =
      (roundsPlayed ?? 0) +
      (matchesPlayed ?? 0) +
      (matchesWon ?? 0) +
      (matchesLost ?? 0) +
      (kills ?? 0) +
      (deaths ?? 0) +
      (assists ?? 0);

    if (score === 0 && !timePlayed && !side) {
      continue;
    }

    const normalized: OperatorStat = {
      operator,
      side,
      roundsPlayed,
      matchesPlayed,
      matchesWon,
      matchesLost,
      winPercent,
      matchWinPercent,
      kd,
      kills,
      deaths,
      assists,
      headshotPercent,
      headshots,
      timePlayed,
      timePlayedMs,
      clutches,
      clutchesLost,
      firstBloods,
      firstDeaths,
      teamKills,
    };

    const key = operator.toLowerCase();
    const current = grouped.get(key);
    if (!current || score > current.score) {
      grouped.set(key, { score, data: normalized });
    }
  }

  return [...grouped.values()]
    .map((entry) => entry.data)
    .sort((a, b) => (b.roundsPlayed ?? b.matchesPlayed ?? 0) - (a.roundsPlayed ?? a.matchesPlayed ?? 0))
    .slice(0, 12);
}

function pickNestedNumber(source: Record<string, unknown>, aliases: string[]): number | null {
  const nestedSources = [source, readObject(source.stats), readObject(source.summary), readObject(source.metadata)];

  for (const current of nestedSources) {
    if (!current) {
      continue;
    }

    const direct = pickNumber(current, aliases);
    if (direct !== null) {
      return direct;
    }

    for (const alias of aliases) {
      const key = Object.keys(current).find((candidate) => candidate.toLowerCase() === alias.toLowerCase());
      if (!key) {
        continue;
      }

      const nested = readStatNumber(current[key]);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

function readStatNumber(value: unknown): number | null {
  const direct = asNumber(value);
  if (direct !== null) {
    return direct;
  }

  const object = readObject(value);
  if (!object) {
    return null;
  }

  return (
    asNumber(object.value) ??
    asNumber(object.current) ??
    asNumber(object.amount) ??
    asNumber(object.displayValue) ??
    asNumber(object.raw) ??
    asNumber(object.stat)
  );
}

function pickText(source: unknown, aliases: string[]): string | null {
  const object = readObject(source);
  if (!object) {
    return null;
  }

  const nestedSources = [object, readObject(object.metadata), readObject(object.stats), readObject(object.summary)];

  for (const current of nestedSources) {
    if (!current) {
      continue;
    }

    for (const alias of aliases) {
      const direct = readString(current[alias]);
      if (direct) {
        return direct;
      }

      const key = Object.keys(current).find((candidate) => candidate.toLowerCase() === alias.toLowerCase());
      if (!key) {
        continue;
      }

      const value = current[key];
      const text = readString(value) ?? readString(readObject(value)?.value) ?? readString(readObject(value)?.name);
      if (text) {
        return text;
      }
    }
  }

  return null;
}
