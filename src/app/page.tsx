"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NormalizedPlayerStats, PlayerSnapshot, SquadResponse } from "@/lib/types";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/number";

const emptyResponse: SquadResponse = {
  players: [],
  history: [],
  canRefresh: true,
  cooldownEndsAt: null,
  lastUpdatedAt: null,
  source: "empty",
  warnings: [],
};

export default function Home() {
  const [squad, setSquad] = useState<SquadResponse>(emptyResponse);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void loadSquad();
  }, []);

  async function loadSquad() {
    setError(null);
    const response = await fetch("/api/squad", { cache: "no-store" });
    if (!response.ok) {
      setError("Could not load cached squad data.");
      return;
    }
    setSquad(await response.json());
  }

  function refresh() {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/refresh", { method: "POST" });
      const body = (await response.json()) as SquadResponse;
      setSquad(body);

      if (!response.ok && body.cooldownEndsAt) {
        setError(`Refresh cooldown active until ${formatTime(body.cooldownEndsAt)}.`);
      } else if (!response.ok) {
        setError("Refresh failed.");
      }
    });
  }

  const leaderboards = useMemo(() => buildLeaderboards(squad.players), [squad.players]);
  const awards = useMemo(() => buildAwards(squad.players), [squad.players]);
  const squadIntel = useMemo(
    () => buildSquadIntel(squad.players, squad.history),
    [squad.players, squad.history],
  );
  const chemistry = useMemo(() => buildChemistry(squad.players), [squad.players]);
  const chartData = useMemo(() => buildChartData(squad.history), [squad.history]);

  return (
    <main>
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">R6 Squad Room</p>
          <h1>Your stack, your stats, your slander board.</h1>
          <p>
            A public squad dashboard backed by cached R6Data snapshots. Hit refresh
            when you want the latest numbers; the page stays fast from Redis cache.
          </p>
          <div className="heroActions">
            <button disabled={isPending || !squad.canRefresh} onClick={refresh}>
              {isPending ? "Breaching R6Data..." : squad.canRefresh ? "Refresh Stats" : "Cooldown Active"}
            </button>
            <span>{squad.lastUpdatedAt ? `Updated ${formatTime(squad.lastUpdatedAt)}` : "No snapshot yet"}</span>
          </div>
          {error ? <p className="status error">{error}</p> : null}
          {squad.warnings.map((warning) => (
            <p className="status" key={warning}>
              {warning}
            </p>
          ))}
        </div>
        <div className="heroPanel">
          <span>Total Kills</span>
          <strong>{formatNumber(sumMetric(squad.players, "kills"))}</strong>
          <small>{squad.players.length} operators in the stack</small>
        </div>
      </section>

      <section className="cardsGrid">
        {squad.players.length === 0 ? <EmptyState /> : null}
        {squad.players.map((player) => (
          <PlayerCard key={player.playerKey} player={player} />
        ))}
      </section>

      <section className="splitSection">
        <div className="panel">
          <h2>Leaderboard</h2>
          <div className="leaderboards">
            {leaderboards.map((board) => (
              <div className="leaderboard" key={board.label}>
                <span>{board.label}</span>
                <strong>{board.winner?.displayName ?? "--"}</strong>
                <small>{board.value}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="panel awards">
          <h2>Completely Scientific Awards</h2>
          {awards.map((award) => (
            <div className="award" key={award.title}>
              <span>{award.title}</span>
              <strong>{award.player?.displayName ?? "--"}</strong>
              <small>{award.reason}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Squad Intel</h2>
        <div className="intelGrid">
          {squadIntel.map((item) => (
            <div className="intelCard" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.caption}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Questionable Chemistry Lab</h2>
        <p>
          Not real match correlation yet. This ranks pair vibes from current stat profiles,
          so it is useful enough for arguments and bad enough to be funny.
        </p>
        <div className="chemistryGrid">
          {chemistry.map((pair) => (
            <div className="chemistryCard" key={pair.names}>
              <span>{pair.label}</span>
              <strong>{pair.names}</strong>
              <small>{pair.reason}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel chartPanel">
        <h2>RP Timeline</h2>
        <p>Snapshots appear here after refreshes over time.</p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rpGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f5c542" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#f5c542" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.12)" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0b8" />
              <YAxis stroke="#d8d0b8" />
              <Tooltip contentStyle={{ background: "#171713", border: "1px solid #393426" }} />
              <Area type="monotone" dataKey="rankPoints" stroke="#f5c542" fill="url(#rpGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}

function PlayerCard({ player }: { player: NormalizedPlayerStats }) {
  return (
    <article className="playerCard" style={{ "--accent": player.accent } as React.CSSProperties}>
      <div className="cardTop">
        <div>
          <span className="username">{player.username}</span>
          <h2>{player.displayName}</h2>
        </div>
        {player.rankImageUrl ? <img alt="" src={player.rankImageUrl} /> : <div className="rankBadge">R6</div>}
      </div>
      <div className="rankLine">
        <strong>{player.rank ?? "Unranked"}</strong>
        <span>{formatNumber(player.rankPoints)} RP</span>
      </div>
      <div className="statGrid">
        <Metric label="K/D" value={formatDecimal(player.kd)} />
        <Metric label="Win" value={formatPercent(player.winRate)} />
        <Metric label="Kills" value={formatNumber(player.kills)} />
        <Metric label="Deaths" value={formatNumber(player.deaths)} />
        <Metric label="Headshots" value={formatPercent(player.headshotRate)} />
        <Metric label="Hours" value={formatNumber(player.playtimeHours)} />
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState() {
  return (
    <article className="emptyState">
      <h2>No cached squad stats yet.</h2>
      <p>
        Add your R6Data key and Upstash Redis credentials, then press refresh.
      </p>
    </article>
  );
}

function buildLeaderboards(players: NormalizedPlayerStats[]) {
  return [
    leaderboard("Best K/D", players, "kd", (value) => formatDecimal(value)),
    leaderboard("Highest Win Rate", players, "winRate", (value) => formatPercent(value)),
    leaderboard("Most Kills", players, "kills", (value) => formatNumber(value)),
    leaderboard("Most Games", players, "matches", (value) => formatNumber(value)),
  ];
}

function buildAwards(players: NormalizedPlayerStats[]) {
  const deaths = maxPlayer(players, "deaths");
  const assists = maxPlayer(players, "assists");
  const hs = maxPlayer(players, "headshotRate");
  const hours = maxPlayer(players, "playtimeHours");

  return [
    {
      title: "Walking Respawn Timer",
      player: deaths,
      reason: deaths ? `${formatNumber(deaths.deaths)} recorded deaths` : "Needs data",
    },
    {
      title: "Professional Helpful Guy",
      player: assists,
      reason: assists ? `${formatNumber(assists.assists)} assists` : "Needs data",
    },
    {
      title: "Forehead Magnet",
      player: hs,
      reason: hs ? `${formatPercent(hs.headshotRate)} headshot rate` : "Needs data",
    },
    {
      title: "Ranked Landlord",
      player: hours,
      reason: hours ? `${formatNumber(hours.playtimeHours)} hours played` : "Needs data",
    },
    {
      title: "K/D Merchant",
      player: maxPlayer(players, "kd"),
      reason: "Probably says stats do not matter after every death",
    },
    {
      title: "Morale Officer",
      player: minPlayer(players, "kd"),
      reason: "Keeps the enemy team confident",
    },
  ];
}

function buildSquadIntel(players: NormalizedPlayerStats[], history: PlayerSnapshot[]) {
  const avgKd = averageMetric(players, "kd");
  const avgWin = averageMetric(players, "winRate");
  const totalMatches = sumMetric(players, "matches");
  const totalHours = sumMetric(players, "playtimeHours");
  const rankSpread = spreadMetric(players, "rankPoints");
  const mostImproved = findMostImproved(history, "rankPoints");
  const volatile = findMostVolatile(history, "rankPoints");
  const identity = getSquadIdentity(avgKd, avgWin, rankSpread);

  return [
    {
      label: "Stack Identity",
      value: identity.title,
      caption: identity.caption,
    },
    {
      label: "Average K/D",
      value: formatDecimal(avgKd),
      caption: "The number everyone quotes until they lose two rounds.",
    },
    {
      label: "Average Win Rate",
      value: formatPercent(avgWin),
      caption: "The squad's collective ability to not throw match point.",
    },
    {
      label: "Rank Spread",
      value: rankSpread === null ? "--" : `${formatNumber(rankSpread)} RP`,
      caption: "Lower means balanced stack. Higher means someone is babysitting.",
    },
    {
      label: "Total Grind",
      value: totalHours === null ? "--" : `${formatNumber(totalHours)}h`,
      caption: `${formatNumber(totalMatches)} tracked matches across the five-stack.`,
    },
    {
      label: "Most Improved",
      value: mostImproved?.name ?? "--",
      caption: mostImproved ? `Up ${formatNumber(mostImproved.delta)} RP across snapshots.` : "Needs more snapshots.",
    },
    {
      label: "RP Rollercoaster",
      value: volatile?.name ?? "--",
      caption: volatile ? `${formatNumber(volatile.range)} RP swing. Emotional damage likely.` : "Needs more snapshots.",
    },
  ];
}

function buildChemistry(players: NormalizedPlayerStats[]) {
  const pairs = buildPairs(players);

  return [
    bestPair("Stat Twins", pairs, (pair) => -pair.distance, "Closest overall profile. Same braincell queue."),
    bestPair("Carry + Chaos", pairs, (pair) => pair.kdGap + pair.winGap / 10, "Maximum stat contrast. One plants, one has excuses."),
    bestPair("Rank Crime Duo", pairs, (pair) => pair.rankGap, "Biggest RP gap. Matchmaking should file a report."),
    bestPair("Balanced Duo", pairs, (pair) => -pair.rankGap - pair.kdGap * 250, "Closest rank and K/D. Least likely to blame each other."),
  ].filter((pair) => pair.names !== "--");
}

function leaderboard(
  label: string,
  players: NormalizedPlayerStats[],
  key: keyof NormalizedPlayerStats,
  formatter: (value: number | null) => string,
) {
  const winner = maxPlayer(players, key);
  const value = winner ? formatter(winner[key] as number | null) : "--";

  return { label, winner, value };
}

function maxPlayer(players: NormalizedPlayerStats[], key: keyof NormalizedPlayerStats) {
  return players.reduce<NormalizedPlayerStats | null>((best, player) => {
    const value = player[key];
    const bestValue = best?.[key];

    if (typeof value !== "number") {
      return best;
    }

    if (typeof bestValue !== "number" || value > bestValue) {
      return player;
    }

    return best;
  }, null);
}

function minPlayer(players: NormalizedPlayerStats[], key: keyof NormalizedPlayerStats) {
  return players.reduce<NormalizedPlayerStats | null>((best, player) => {
    const value = player[key];
    const bestValue = best?.[key];

    if (typeof value !== "number") {
      return best;
    }

    if (typeof bestValue !== "number" || value < bestValue) {
      return player;
    }

    return best;
  }, null);
}

function sumMetric(players: NormalizedPlayerStats[], key: keyof NormalizedPlayerStats) {
  const values = players
    .map((player) => player[key])
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0);
}

function averageMetric(players: NormalizedPlayerStats[], key: keyof NormalizedPlayerStats) {
  const values = players
    .map((player) => player[key])
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function spreadMetric(players: NormalizedPlayerStats[], key: keyof NormalizedPlayerStats) {
  const values = players
    .map((player) => player[key])
    .filter((value): value is number => typeof value === "number");

  if (values.length < 2) {
    return null;
  }

  return Math.max(...values) - Math.min(...values);
}

function getSquadIdentity(
  avgKd: number | null,
  avgWin: number | null,
  rankSpread: number | null,
) {
  if (avgKd !== null && avgKd >= 1.15 && avgWin !== null && avgWin >= 55) {
    return {
      title: "War Room",
      caption: "Good K/D and good win rate. Annoyingly competent.",
    };
  }

  if (rankSpread !== null && rankSpread > 1200) {
    return {
      title: "Boosting Allegations",
      caption: "The RP spread is wide enough to need a court statement.",
    };
  }

  if (avgKd !== null && avgKd >= 1.1) {
    return {
      title: "Aim Lab Lobby",
      caption: "Kills are happening. Whether rounds are won is a separate investigation.",
    };
  }

  if (avgWin !== null && avgWin >= 52) {
    return {
      title: "Rat Stack",
      caption: "Not always pretty, somehow still winning.",
    };
  }

  return {
    title: "Content Stack",
    caption: "Statistically built for entertainment.",
  };
}

function findMostImproved(history: PlayerSnapshot[], key: keyof PlayerSnapshot) {
  const grouped = groupSnapshots(history, key);
  let best: { name: string; delta: number } | null = null;

  for (const [playerKey, snapshots] of grouped) {
    if (snapshots.length < 2) {
      continue;
    }

    const delta = snapshots[snapshots.length - 1].value - snapshots[0].value;
    const name = playerNameFromKey(playerKey);

    if (delta > 0 && (!best || delta > best.delta)) {
      best = { name, delta };
    }
  }

  return best;
}

function findMostVolatile(history: PlayerSnapshot[], key: keyof PlayerSnapshot) {
  const grouped = groupSnapshots(history, key);
  let best: { name: string; range: number } | null = null;

  for (const [playerKey, snapshots] of grouped) {
    if (snapshots.length < 2) {
      continue;
    }

    const values = snapshots.map((snapshot) => snapshot.value);
    const range = Math.max(...values) - Math.min(...values);
    const name = playerNameFromKey(playerKey);

    if (!best || range > best.range) {
      best = { name, range };
    }
  }

  return best;
}

function groupSnapshots(history: PlayerSnapshot[], key: keyof PlayerSnapshot) {
  const grouped = new Map<string, Array<{ value: number; fetchedAt: string }>>();

  for (const snapshot of history) {
    const value = snapshot[key];

    if (typeof value !== "number") {
      continue;
    }

    const list = grouped.get(snapshot.playerKey) ?? [];
    list.push({ value, fetchedAt: snapshot.fetchedAt });
    grouped.set(snapshot.playerKey, list);
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime());
  }

  return grouped;
}

function playerNameFromKey(playerKey: string) {
  return playerKey
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

type Pair = {
  names: string;
  kdGap: number;
  winGap: number;
  rankGap: number;
  distance: number;
};

function buildPairs(players: NormalizedPlayerStats[]): Pair[] {
  const pairs: Pair[] = [];

  for (let left = 0; left < players.length; left += 1) {
    for (let right = left + 1; right < players.length; right += 1) {
      const a = players[left];
      const b = players[right];
      const kdGap = metricGap(a.kd, b.kd);
      const winGap = metricGap(a.winRate, b.winRate);
      const rankGap = metricGap(a.rankPoints, b.rankPoints);

      pairs.push({
        names: `${a.displayName} + ${b.displayName}`,
        kdGap,
        winGap,
        rankGap,
        distance: kdGap * 250 + winGap * 8 + rankGap,
      });
    }
  }

  return pairs;
}

function bestPair(
  label: string,
  pairs: Pair[],
  scorer: (pair: Pair) => number,
  reason: string,
) {
  const pair = pairs.reduce<Pair | null>((best, current) => {
    if (!best || scorer(current) > scorer(best)) {
      return current;
    }

    return best;
  }, null);

  return {
    label,
    names: pair?.names ?? "--",
    reason,
  };
}

function metricGap(left: number | null, right: number | null) {
  if (left === null || right === null) {
    return 0;
  }

  return Math.abs(left - right);
}

function buildChartData(history: PlayerSnapshot[]) {
  return history
    .filter((snapshot) => snapshot.rankPoints !== null)
    .slice(-50)
    .map((snapshot) => ({
      label: new Date(snapshot.fetchedAt).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      }),
      rankPoints: snapshot.rankPoints,
    }));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
