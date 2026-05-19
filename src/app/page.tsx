"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { friends } from "@/config/friends";
import type { StoredMatchSummary } from "@/lib/matchTypes";
import type { NormalizedPlayerStats, SquadResponse } from "@/lib/types";
import {
  buildMatchAnalytics,
  buildOperatorAnalytics,
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
  const operatorCards = useMemo(() => buildOperatorAnalytics(squad.players), [squad.players]);
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
          <h1>Command center.</h1>
          <p>
            Ranked-only squad data with exact stack comparisons, per-player pages, and operator
            breakdowns. R6Data powers the live player cards; the mini-PC scraper powers the local
            match archive.
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
            <p className="status" key={warning}>
              {warning}
            </p>
          ))}
        </div>
        <div className="heroPanel">
          <span>Ranked matches</span>
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
          options={[["all", "Ranked"], ...analytics.playlists.map((playlist) => [playlist, playlist] as const)]}
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
          <h2>Click Into The Squad</h2>
          <div className="squadLinks">
            {friends.map((friend) => (
              <a className="squadLink" href={`/players/${friend.key}`} key={friend.key}>
                <strong>{friend.displayName}</strong>
                <span>Player page</span>
              </a>
            ))}
            <a className="squadLink accent" href="/stack-lab">
              <strong>Stack Lab</strong>
              <span>Best duo/trio/full-stack comparisons</span>
            </a>
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
          <h2>Player Cards</h2>
          <div className="playerRows">
            {squad.players.map((player) => (
              <PlayerMini key={player.playerKey} player={player} />
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Exact Stack Lineups</h2>
        <div className="stackCards">
          {analytics.exactStackLineups.slice(0, 8).map((lineup) => (
            <a className="stackCard" href="/stack-lab" key={lineup.key}>
              <strong>{lineup.resultLabel}</strong>
              <span>
                {lineup.matches} matches | {formatPercent(lineup.winRate)} win | {formatDecimal(lineup.kd)} K/D
              </span>
              <small>{lineup.stackPlayerNames.join(" + ") || lineup.stackPlayerKeys.join(" + ")}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="splitSection">
        <div className="panel">
          <h2>Operator Picks</h2>
          <div className="operatorGrid">
            {operatorCards.map((operator) => (
              <div className="operatorCard" key={operator.operator}>
                <strong>{operator.operator}</strong>
                <span>{operator.matches} matches</span>
                <small>{formatPercent(operator.winRate)} win | {formatDecimal(operator.kd)} K/D</small>
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
                <small>
                  {formatPercent(map.winRate)} win | {formatDecimal(map.kd)} K/D
                </small>
              </div>
            ))}
          </div>
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
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
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

function PlayerMini({ player }: { player: NormalizedPlayerStats }) {
  return (
    <a className="playerMini" href={`/players/${player.playerKey}`}>
      <strong>{player.displayName}</strong>
      <span>
        {player.rank ?? "Unranked?"} | {formatDecimal(player.kd)} K/D
      </span>
      <small>{formatPercent(player.winRate)} win | {formatNumber(player.matches)} matches</small>
    </a>
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
