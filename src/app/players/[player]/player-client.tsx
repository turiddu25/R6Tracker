"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildPlayerAnalytics, buildOperatorAnalytics } from "@/lib/matchAnalytics";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/number";
import type { StoredMatchSummary } from "@/lib/matchTypes";
import type { NormalizedPlayerStats } from "@/lib/types";

type MatchesResponse = {
  activeSeasonKey: string;
  activeSeasonName: string;
  matches: StoredMatchSummary[];
};

type SquadResponse = {
  players: NormalizedPlayerStats[];
};

const emptyMatches: MatchesResponse = {
  activeSeasonKey: "unknown",
  activeSeasonName: "Unknown Season",
  matches: [],
};

export default function PlayerClient({
  playerKey,
  displayName,
  accent,
}: {
  playerKey: string;
  displayName: string;
  accent: string;
}) {
  const [matchData, setMatchData] = useState<MatchesResponse>(emptyMatches);
  const [squad, setSquad] = useState<SquadResponse>({ players: [] });
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void fetch("/api/matches", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: MatchesResponse) => setMatchData(body));
    void fetch("/api/squad", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: SquadResponse) => setSquad(body));
  }, []);

  const analytics = useMemo(() => buildPlayerAnalytics(matchData.matches, playerKey), [matchData.matches, playerKey]);
  const operatorCards = useMemo(
    () => buildOperatorAnalytics(squad.players.filter((player) => player.playerKey === playerKey)),
    [playerKey, squad.players],
  );

  function refreshStats() {
    startTransition(async () => {
      setStatus(null);
      const response = await fetch("/api/refresh", { method: "POST" });
      const body = await response.json();

      if (!response.ok) {
        setStatus(body.error ?? "Could not refresh R6Data.");
        return;
      }

      setStatus("R6Data refreshed. Operator data should update shortly.");
      void fetch("/api/squad", { cache: "no-store" })
        .then((res) => res.json())
        .then((body: SquadResponse) => setSquad(body));
    });
  }

  if (!analytics.player) {
    return (
      <main>
        <section className="panel">
          <h1>{displayName}</h1>
          <p>No ranked match data yet.</p>
          <a className="adminLink" href="/">
            Back to home
          </a>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="hero matchHero">
        <div className="heroCopy">
          <p className="eyebrow">{displayName}</p>
          <h1>{analytics.player.displayName} page.</h1>
          <p>Player-specific ranked archive, stack partners, favorite maps, and operator usage.</p>
          <div className="heroActions">
            <button disabled={isPending} onClick={refreshStats} type="button">
              {isPending ? "Refreshing..." : "Refresh R6Data"}
            </button>
            <a className="adminLink" href="/">
              Back to home
            </a>
          </div>
          {status ? <p className="status">{status}</p> : null}
        </div>
        <div className="heroPanel" style={{ background: `linear-gradient(160deg, ${accent}40, transparent 42%), var(--panel-strong)` }}>
          <span>Ranked games</span>
          <strong>{formatNumber(analytics.totals.matches)}</strong>
          <small>{formatPercent(analytics.totals.winRate)} win</small>
        </div>
      </section>

      <section className="intelGrid">
        <Metric label="Kills" value={formatNumber(analytics.totals.kills)} />
        <Metric label="Deaths" value={formatNumber(analytics.totals.deaths)} />
        <Metric label="K/D" value={formatDecimal(analytics.totals.kd)} />
        <Metric label="RP" value={formatNumber(analytics.totals.rpDelta)} />
      </section>

      <section className="splitSection">
        <div className="panel">
          <h2>Best Lineups</h2>
          <div className="stackCards">
            {analytics.lineups.map((lineup) => (
              <div className="stackCard" key={lineup.key}>
                <strong>{lineup.resultLabel}</strong>
                <span>
                  {lineup.matches} matches | {formatPercent(lineup.winRate)} win
                </span>
                <small>{formatDecimal(lineup.kd)} K/D</small>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Top Operators</h2>
          {operatorCards.length > 0 ? (
            <div className="operatorGrid">
              {operatorCards.map((operator) => (
                <div className="operatorCard" key={operator.operator}>
                  <strong>{operator.operator}</strong>
                  <span>{operator.matches} matches</span>
                  <small>{formatPercent(operator.winRate)} win | {formatDecimal(operator.kd)} K/D</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyState">
              <h2>No operator data yet.</h2>
              <p>Click Refresh R6Data on this page or the home page after a refresh window.</p>
            </div>
          )}
        </div>
      </section>

      <section className="chartGrid">
        <div className="panel chartPanel">
          <h2>Daily form</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.daily}>
              <CartesianGrid stroke="rgba(255,255,255,.12)" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0b8" />
              <YAxis stroke="#d8d0b8" />
              <Tooltip contentStyle={{ background: "#171713", border: "1px solid #393426" }} />
              <Bar dataKey="matches" fill={accent} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel">
          <h2>Map Bias</h2>
          <div className="mapGrid">
            {analytics.maps.map((map) => (
              <div className="mapCard" key={map.map}>
                <strong>{map.map}</strong>
                <span>{map.matches} games</span>
                <small>{formatPercent(map.winRate)} win | {formatDecimal(map.kd)} K/D</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="intelCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
