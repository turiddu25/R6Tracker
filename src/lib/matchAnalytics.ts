import type { StoredMatchSummary } from "@/lib/matchTypes";

export type StackFilter = "all" | "solo" | "duo" | "trio" | "four" | "full";
export type TimeFilter = "all" | "today" | "week";

export type MatchFilters = {
  stack: StackFilter;
  time: TimeFilter;
  playlist: string;
  player: string;
};

export type PlayerMatchCard = {
  playerKey: string;
  displayName: string;
  matches: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number | null;
  winRate: number | null;
  rpDelta: number;
};

export type StackBreakdown = {
  label: string;
  stackSize: number;
  matches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  kills: number;
  deaths: number;
  kd: number | null;
  rpDelta: number;
};

export type DailyPoint = {
  label: string;
  date: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  rpDelta: number;
  kills: number;
  deaths: number;
};

export type MapCard = {
  map: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number | null;
  kd: number | null;
};

export type AwardCard = {
  title: string;
  value: string;
  caption: string;
};

export type MatchAnalytics = {
  totals: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number | null;
    kills: number;
    deaths: number;
    assists: number;
    kd: number | null;
    rpDelta: number;
    fullStackMatches: number;
    duoMatches: number;
    trioMatches: number;
    fourStackMatches: number;
  };
  players: PlayerMatchCard[];
  stackBreakdown: StackBreakdown[];
  daily: DailyPoint[];
  maps: MapCard[];
  awards: AwardCard[];
  latestMatches: StoredMatchSummary[];
  playlists: string[];
};

export function buildMatchAnalytics(
  matches: StoredMatchSummary[],
  filters: MatchFilters,
): MatchAnalytics {
  const filtered = filterMatches(matches, filters);
  const totals = buildTotals(filtered);

  return {
    totals,
    players: buildPlayers(filtered),
    stackBreakdown: buildStackBreakdown(filtered),
    daily: buildDaily(filtered),
    maps: buildMaps(filtered),
    awards: buildAwards(filtered, totals),
    latestMatches: filtered.slice(0, 18),
    playlists: [...new Set(matches.map((match) => match.playlist ?? "Unknown"))].sort(),
  };
}

function filterMatches(matches: StoredMatchSummary[], filters: MatchFilters) {
  return matches.filter((match) => {
    if (filters.stack !== "all" && stackFilterValue(match) !== filters.stack) {
      return false;
    }

    if (filters.time !== "all" && !isInTimeWindow(match.startedAt, filters.time)) {
      return false;
    }

    if (filters.playlist !== "all" && (match.playlist ?? "Unknown") !== filters.playlist) {
      return false;
    }

    if (
      filters.player !== "all" &&
      !match.stack.stackPlayerKeys.includes(filters.player)
    ) {
      return false;
    }

    return true;
  });
}

function stackFilterValue(match: StoredMatchSummary): StackFilter {
  if (match.stack.isFullStack || match.stack.stackSize >= 5) return "full";
  if (match.stack.stackSize === 4) return "four";
  if (match.stack.stackSize === 3) return "trio";
  if (match.stack.stackSize === 2) return "duo";
  return "solo";
}

function isInTimeWindow(value: string, filter: TimeFilter) {
  const timestamp = new Date(value).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  if (filter === "today") {
    return timestamp >= now - day;
  }

  if (filter === "week") {
    return timestamp >= now - day * 7;
  }

  return true;
}

function buildTotals(matches: StoredMatchSummary[]) {
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  const kills = sumMatchPlayers(matches, "kills");
  const deaths = sumMatchPlayers(matches, "deaths");
  const assists = sumMatchPlayers(matches, "assists");
  const rpDelta = sumMatchPlayers(matches, "rpDelta");

  return {
    matches: matches.length,
    wins,
    losses,
    winRate: percentage(wins, wins + losses),
    kills,
    deaths,
    assists,
    kd: ratio(kills, deaths),
    rpDelta,
    fullStackMatches: matches.filter((match) => match.stack.stackSize >= 5).length,
    duoMatches: matches.filter((match) => match.stack.stackSize === 2).length,
    trioMatches: matches.filter((match) => match.stack.stackSize === 3).length,
    fourStackMatches: matches.filter((match) => match.stack.stackSize === 4).length,
  };
}

function buildPlayers(matches: StoredMatchSummary[]) {
  const grouped = new Map<string, PlayerMatchCard>();

  for (const match of matches) {
    for (const player of match.players) {
      if (player.playerKey === "unknown") continue;

      const current =
        grouped.get(player.playerKey) ??
        {
          playerKey: player.playerKey,
          displayName: player.displayName,
          matches: 0,
          wins: 0,
          losses: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          kd: null,
          winRate: null,
          rpDelta: 0,
        };

      current.matches += 1;
      current.wins += player.result === "win" ? 1 : 0;
      current.losses += player.result === "loss" ? 1 : 0;
      current.kills += player.kills ?? 0;
      current.deaths += player.deaths ?? 0;
      current.assists += player.assists ?? 0;
      current.rpDelta += player.rpDelta ?? 0;
      current.kd = ratio(current.kills, current.deaths);
      current.winRate = percentage(current.wins, current.wins + current.losses);
      grouped.set(player.playerKey, current);
    }
  }

  return [...grouped.values()].sort((a, b) => b.kills - a.kills);
}

function buildStackBreakdown(matches: StoredMatchSummary[]) {
  return [1, 2, 3, 4, 5].map((stackSize) => {
    const stackMatches = matches.filter((match) =>
      stackSize === 5 ? match.stack.stackSize >= 5 : match.stack.stackSize === stackSize,
    );
    const wins = stackMatches.filter((match) => match.result === "win").length;
    const losses = stackMatches.filter((match) => match.result === "loss").length;
    const kills = sumMatchPlayers(stackMatches, "kills");
    const deaths = sumMatchPlayers(stackMatches, "deaths");

    return {
      label: stackSize === 5 ? "Full Stack" : `${stackSize}-Stack`,
      stackSize,
      matches: stackMatches.length,
      wins,
      losses,
      winRate: percentage(wins, wins + losses),
      kills,
      deaths,
      kd: ratio(kills, deaths),
      rpDelta: sumMatchPlayers(stackMatches, "rpDelta"),
    };
  });
}

function buildDaily(matches: StoredMatchSummary[]) {
  const grouped = new Map<string, StoredMatchSummary[]>();

  for (const match of matches) {
    const key = match.startedAt.slice(0, 10);
    grouped.set(key, [...(grouped.get(key) ?? []), match]);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, dayMatches]) => {
      const wins = dayMatches.filter((match) => match.result === "win").length;
      const losses = dayMatches.filter((match) => match.result === "loss").length;

      return {
        label: new Date(date).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
        date,
        matches: dayMatches.length,
        wins,
        losses,
        winRate: percentage(wins, wins + losses),
        rpDelta: sumMatchPlayers(dayMatches, "rpDelta"),
        kills: sumMatchPlayers(dayMatches, "kills"),
        deaths: sumMatchPlayers(dayMatches, "deaths"),
      };
    });
}

function buildMaps(matches: StoredMatchSummary[]) {
  const grouped = new Map<string, StoredMatchSummary[]>();

  for (const match of matches) {
    const key = match.map ?? "Unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), match]);
  }

  return [...grouped.entries()]
    .map(([map, mapMatches]) => {
      const wins = mapMatches.filter((match) => match.result === "win").length;
      const losses = mapMatches.filter((match) => match.result === "loss").length;
      const kills = sumMatchPlayers(mapMatches, "kills");
      const deaths = sumMatchPlayers(mapMatches, "deaths");

      return {
        map,
        matches: mapMatches.length,
        wins,
        losses,
        winRate: percentage(wins, wins + losses),
        kd: ratio(kills, deaths),
      };
    })
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 8);
}

function buildAwards(matches: StoredMatchSummary[], totals: MatchAnalytics["totals"]) {
  const players = buildPlayers(matches);
  const bestKiller = players[0];
  const worstRp = players.slice().sort((a, b) => a.rpDelta - b.rpDelta)[0];
  const bestRp = players.slice().sort((a, b) => b.rpDelta - a.rpDelta)[0];
  const fullStackWins = matches.filter((match) => match.stack.stackSize >= 5 && match.result === "win").length;

  return [
    {
      title: "Stack Dependency Index",
      value: `${totals.fourStackMatches + totals.fullStackMatches}`,
      caption: "Games where at least four of you were together.",
    },
    {
      title: "Full-Stack Myth Counter",
      value: String(totals.fullStackMatches),
      caption: `${fullStackWins} full-stack wins recorded from ingested matches.`,
    },
    {
      title: "Certified Entry Goblin",
      value: bestKiller?.displayName ?? "--",
      caption: bestKiller ? `${bestKiller.kills} kills in filtered matches.` : "Needs match data.",
    },
    {
      title: "RP Laundering Suspect",
      value: bestRp?.displayName ?? "--",
      caption: bestRp ? `${signed(bestRp.rpDelta)} RP in this filter.` : "Needs ranked data.",
    },
    {
      title: "Ranked Taxpayer",
      value: worstRp?.displayName ?? "--",
      caption: worstRp ? `${signed(worstRp.rpDelta)} RP. Painfully audited.` : "Needs ranked data.",
    },
  ];
}

function sumMatchPlayers(matches: StoredMatchSummary[], key: "kills" | "deaths" | "assists" | "rpDelta") {
  return matches.reduce(
    (total, match) =>
      total + match.players.reduce((playerTotal, player) => playerTotal + (player[key] ?? 0), 0),
    0,
  );
}

function ratio(left: number, right: number) {
  if (right === 0) return null;
  return Math.round((left / right) * 100) / 100;
}

function percentage(left: number, right: number) {
  if (right === 0) return null;
  return Math.round((left / right) * 1000) / 10;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}
