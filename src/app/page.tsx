"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StoredMatchSummary } from "@/lib/matchTypes";
import type { NormalizedPlayerStats, SquadResponse } from "@/lib/types";
import {
  buildMatchAnalytics,
  type MatchFilters,
  type StackFilter,
  type TimeFilter,
} from "@/lib/matchAnalytics";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/number";

type MatchesResponse = {
  activeSeasonKey: string;
  activeSeasonName: string;
  matches: StoredMatchSummary[];
};

const emptySquad: SquadResponse = {
  players: [],
  history: [],
  canRefresh: true,
  cooldownEndsAt: null,
  lastUpdatedAt: null,
  source: "empty",
  activeSeasonKey: "unknown",
  activeSeasonName: "Unknown Season",
  warnings: [],
};

const emptyMatches: MatchesResponse = {
  activeSeasonKey: "unknown",
  activeSeasonName: "Unknown Season",
  matches: [],
};

export default function Home() {
  const [squad, setSquad] = useState<SquadResponse>(emptySquad);
  const [matchData, setMatchData] = useState<MatchesResponse>(emptyMatches);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MatchFilters>({
    stack: "all",
    time: "week",
    playlist: "all",
    player: "all",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    setError(null);
    const [squadResponse, matchesResponse] = await Promise.all([
      fetch("/api/squad", { cache: "no-store" }),
      fetch("/api/matches", { cache: "no-store" }),
    ]);

    if (!squadResponse.ok || !matchesResponse.ok) {
      setError("Could not load dashboard data.");
      return;
    }

    setSquad(await squadResponse.json());
    setMatchData(await matchesResponse.json());
  }

  function refreshStats() {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/refresh", { method: "POST" });
      const body = (await response.json()) as SquadResponse;
      setSquad(body);

      if (!response.ok && body.cooldownEndsAt) {
        setError(`Refresh cooldown active until ${formatTime(body.cooldownEndsAt)}.`);
      } else if (!response.ok) {
        setError("R6Data refresh failed.");
      }
    });
  }

  const analytics = useMemo(
    () => buildMatchAnalytics(matchData.matches, filters),
    [matchData.matches, filters],
  );
  const playerOptions = useMemo(() => {
    const keys = new Map<string, string>();

    for (const match of matchData.matches) {
      for (const player of match.players) {
        if (player.playerKey !== "unknown") {
          keys.set(player.playerKey, player.displayName);
        }
      }
    }

    return [...keys.entries()];
  }, [matchData.matches]);

  return (
    <main>
      <section className="hero matchHero">
        <div className="heroCopy">
          <p className="eyebrow">R6 Squad Room</p>
          <h1>The Stack Lab.</h1>
          <p>
            Match-level filters for solo games, duo queues, trio queues,
            four-stacks, and full-stack nights. The scraper runs locally; this
            page only reads normalized match summaries.
          </p>
          <p className="seasonPill">Current split: {matchData.activeSeasonName}</p>
          <div className="heroActions">
            <button disabled={isPending || !squad.canRefresh} onClick={refreshStats}>
              {isPending ? "Refreshing..." : "Refresh R6Data"}
            </button>
            <button onClick={() => void loadDashboard()} type="button">
              Reload Dashboard
            </button>
            <a className="adminLink" href="/admin">
              Admin Scraper
            </a>
          </div>
          {error ? <p className="status error">{error}</p> : null}
          {squad.warnings.map((warning) => (
            <p className="status" key={warning}>{warning}</p>
          ))}
        </div>
        <div className="heroPanel">
          <span>Filtered Matches</span>
          <strong>{formatNumber(analytics.totals.matches)}</strong>
          <small>{analytics.totals.fullStackMatches} full-stack games found</small>
        </div>
      </section>

      <section className="filterDock panel">
        <FilterGroup
          label="Stack"
          value={filters.stack}
          options={[
            ["all", "All"],
            ["solo", "Solo"],
            ["duo", "Duo"],
            ["trio", "Trio"],
            ["four", "4-Stack"],
            ["full", "Full"],
          ]}
          onChange={(value) => setFilters((current) => ({ ...current, stack: value as StackFilter }))}
        />
        <FilterGroup
          label="Time"
          value={filters.time}
          options={[
            ["all", "All"],
            ["today", "24h"],
            ["week", "7d"],
          ]}
          onChange={(value) => setFilters((current) => ({ ...current, time: value as TimeFilter }))}
        />
        <FilterGroup
          label="Playlist"
          value={filters.playlist}
          options={[["all", "All"], ...analytics.playlists.map((playlist) => [playlist, playlist] as const)]}
          onChange={(value) => setFilters((current) => ({ ...current, playlist: value }))}
        />
        <FilterGroup
          label="Player"
          value={filters.player}
          options={[["all", "All"], ...playerOptions.map(([key, name]) => [key, name] as const)]}
          onChange={(value) => setFilters((current) => ({ ...current, player: value }))}
        />
      </section>

      <section className="intelGrid">
        <Kpi label="W/L" value={`${analytics.totals.wins}-${analytics.totals.losses}`} caption={formatPercent(analytics.totals.winRate)} />
        <Kpi label="Squad K/D" value={formatDecimal(analytics.totals.kd)} caption={`${formatNumber(analytics.totals.kills)}K / ${formatNumber(analytics.totals.deaths)}D`} />
        <Kpi label="RP Swing" value={signed(analytics.totals.rpDelta)} caption="Combined filtered ranked delta" />
        <Kpi label="Stacked Games" value={formatNumber(analytics.totals.duoMatches + analytics.totals.trioMatches + analytics.totals.fourStackMatches + analytics.totals.fullStackMatches)} caption="Duo or bigger" />
      </section>

      <section className="splitSection">
        <div className="panel">
          <h2>Stack Performance</h2>
          <div className="stackBars">
            {analytics.stackBreakdown.map((stack) => (
              <div className="stackBar" key={stack.label}>
                <div>
                  <strong>{stack.label}</strong>
                  <span>{stack.matches} matches</span>
                </div>
                <div className="barTrack">
                  <div style={{ width: `${Math.min(stack.winRate ?? 0, 100)}%` }} />
                </div>
                <small>{formatPercent(stack.winRate)} win | {formatDecimal(stack.kd)} K/D | {signed(stack.rpDelta)} RP</small>
              </div>
            ))}
          </div>
        </div>
        <div className="panel awards">
          <h2>Squad Crimes</h2>
          {analytics.awards.map((award) => (
            <div className="award" key={award.title}>
              <span>{award.title}</span>
              <strong>{award.value}</strong>
              <small>{award.caption}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="chartGrid">
        <div className="panel chartPanel">
          <h2>Daily RP Damage</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.daily}>
              <CartesianGrid stroke="rgba(255,255,255,.12)" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0b8" />
              <YAxis stroke="#d8d0b8" />
              <Tooltip contentStyle={{ background: "#171713", border: "1px solid #393426" }} />
              <Bar dataKey="rpDelta" fill="#f5c542" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel chartPanel">
          <h2>Games Per Day</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.daily}>
              <CartesianGrid stroke="rgba(255,255,255,.12)" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0b8" />
              <YAxis stroke="#d8d0b8" />
              <Tooltip contentStyle={{ background: "#171713", border: "1px solid #393426" }} />
              <Line type="monotone" dataKey="matches" stroke="#91ff9e" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="splitSection">
        <div className="panel">
          <h2>Player Form</h2>
          <div className="playerRows">
            {analytics.players.map((player) => (
              <div className="playerRow" key={player.playerKey}>
                <strong>{player.displayName}</strong>
                <span>{player.matches} games</span>
                <span>{formatDecimal(player.kd)} K/D</span>
                <span>{formatPercent(player.winRate)} win</span>
                <span>{signed(player.rpDelta)} RP</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Map Court</h2>
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

      <section className="panel">
        <h2>Recent Match Feed</h2>
        <div className="matchFeed">
          {analytics.latestMatches.length === 0 ? <EmptyMatches /> : null}
          {analytics.latestMatches.map((match) => (
            <article className="matchRow" key={match.id}>
              <div>
                <strong>{match.map ?? "Unknown Map"}</strong>
                <span>{formatTime(match.startedAt)} | {match.playlist ?? "Unknown"} | {match.score ?? "--"}</span>
              </div>
              <div>
                <strong className={match.result === "win" ? "winText" : match.result === "loss" ? "lossText" : ""}>{match.result.toUpperCase()}</strong>
                <span>{match.stack.stackSize}-stack | {match.confidence}</span>
              </div>
              <small>{match.stack.stackPlayerKeys.join(", ") || "unknown stack"}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="filterGroup">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function Kpi({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="intelCard kpiCard">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

function EmptyMatches() {
  return (
    <div className="emptyState">
      <h2>No ingested matches yet.</h2>
      <p>Start the mini PC worker, open `/admin`, and run the scraper after a session.</p>
    </div>
  );
}

function signed(value: number) {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
