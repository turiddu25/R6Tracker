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
  const chartData = useMemo(() => buildChartData(squad.history), [squad.history]);

  return (
    <main>
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">R6 Squad Room</p>
          <h1>Your stack, your stats, your slander board.</h1>
          <p>
            A public squad dashboard backed by cached R6Data snapshots. Hit refresh
            when you want the latest numbers; the page stays fast from Supabase cache.
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
        Add your R6Data key, Supabase credentials, run the schema, then press refresh.
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
  ];
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

function sumMetric(players: NormalizedPlayerStats[], key: keyof NormalizedPlayerStats) {
  const values = players
    .map((player) => player[key])
    .filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0);
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
