import { friends, refreshCooldownMinutes } from "@/config/friends";
import { fetchR6DataBundle } from "@/lib/r6data";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { NormalizedPlayerStats, PlayerSnapshot, SquadResponse } from "@/lib/types";
import { normalizePlayerStats } from "@/lib/normalize";

let memoryLatest: NormalizedPlayerStats[] = [];
let memoryHistory: PlayerSnapshot[] = [];
let memoryLastRefreshAt: string | null = null;

export async function getSquad(): Promise<SquadResponse> {
  const supabase = getSupabaseAdmin();
  const warnings: string[] = [];

  if (!supabase) {
    warnings.push("Supabase is not configured. Showing in-memory data only.");
    return buildResponse(memoryLatest, memoryHistory, memoryLastRefreshAt, "empty", warnings);
  }

  const [latestResult, historyResult] = await Promise.all([
    supabase
      .from("latest_player_stats")
      .select("normalized, fetched_at")
      .order("fetched_at", { ascending: false }),
    supabase
      .from("player_stat_snapshots")
      .select("player_key, fetched_at, normalized")
      .order("fetched_at", { ascending: true })
      .limit(200),
  ]);

  if (latestResult.error) {
    warnings.push(latestResult.error.message);
  }

  if (historyResult.error) {
    warnings.push(historyResult.error.message);
  }

  const players =
    latestResult.data?.map((row) => row.normalized as NormalizedPlayerStats) ?? memoryLatest;
  const history =
    historyResult.data?.map((row) => toSnapshot(row.normalized as NormalizedPlayerStats)) ??
    memoryHistory;
  const lastUpdatedAt = newestFetchedAt(players);

  return buildResponse(players, history, lastUpdatedAt, "supabase", warnings);
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

  const supabase = getSupabaseAdmin();
  const players = refreshed.map(({ normalized }) => normalized);
  const history = players.map(toSnapshot);

  memoryLatest = mergeLatest(memoryLatest, players);
  memoryHistory = [...memoryHistory, ...history].slice(-200);
  memoryLastRefreshAt = fetchedAt;

  if (supabase) {
    const latestRows = refreshed.map(({ friend, normalized, raw }) => ({
      player_key: friend.key,
      display_name: friend.displayName,
      platform_type: friend.platformType,
      platform_family: friend.platformFamily,
      normalized,
      raw,
      fetched_at: fetchedAt,
    }));

    const snapshotRows = latestRows.map(({ player_key, display_name, platform_type, platform_family, normalized, raw, fetched_at }) => ({
      player_key,
      display_name,
      platform_type,
      platform_family,
      normalized,
      raw,
      fetched_at,
    }));

    const [upsertResult, insertResult] = await Promise.all([
      supabase.from("latest_player_stats").upsert(latestRows, { onConflict: "player_key" }),
      supabase.from("player_stat_snapshots").insert(snapshotRows),
    ]);

    if (upsertResult.error) {
      warnings.push(upsertResult.error.message);
    }

    if (insertResult.error) {
      warnings.push(insertResult.error.message);
    }
  } else {
    warnings.push("Supabase is not configured. Refreshed data was not persisted.");
  }

  return {
    squad: buildResponse(memoryLatest, memoryHistory, fetchedAt, supabase ? "supabase" : "live", warnings),
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

  return {
    players: sortLikeConfig(players),
    history,
    canRefresh: cooldownEndsAt === null || Date.now() >= new Date(cooldownEndsAt).getTime(),
    cooldownEndsAt,
    lastUpdatedAt,
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
  return {
    playerKey: player.playerKey,
    fetchedAt: player.fetchedAt,
    kd: player.kd,
    winRate: player.winRate,
    rankPoints: player.rankPoints,
    matches: player.matches,
  };
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
