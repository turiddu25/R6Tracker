"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildStackAnalytics } from "@/lib/matchAnalytics";
import { formatDecimal, formatNumber, formatPercent } from "@/lib/number";
import type { StoredMatchSummary } from "@/lib/matchTypes";

type MatchesResponse = {
  activeSeasonKey: string;
  activeSeasonName: string;
  matches: StoredMatchSummary[];
};

const emptyMatches: MatchesResponse = {
  activeSeasonKey: "unknown",
  activeSeasonName: "Unknown Season",
  matches: [],
};

export default function StackLabPage() {
  const [matchData, setMatchData] = useState<MatchesResponse>(emptyMatches);

  useEffect(() => {
    void fetch("/api/matches", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: MatchesResponse) => setMatchData(body));
  }, []);

  const analytics = useMemo(() => buildStackAnalytics(matchData.matches), [matchData.matches]);
  const duoLineups = analytics.lineups.filter((lineup) => lineup.stackSize === 2).slice(0, 8);
  const trioLineups = analytics.lineups.filter((lineup) => lineup.stackSize === 3).slice(0, 8);
  const fourLineups = analytics.lineups.filter((lineup) => lineup.stackSize === 4).slice(0, 8);
  const fullLineups = analytics.lineups.filter((lineup) => lineup.stackSize >= 5).slice(0, 8);

  return (
    <main>
      <section className="hero matchHero">
        <div className="heroCopy">
          <p className="eyebrow">Stack Lab</p>
          <h1>Who actually wins together?</h1>
          <p>
            Ranked-only comparisons for duo, trio, four-stack, and full-stack nights. Every card
            is clickable and every board is split by exact lineup, not blended stack mush.
          </p>
          <a className="adminLink" href="/">
            Back to home
          </a>
        </div>
        <div className="heroPanel">
          <span>Stacked matches</span>
          <strong>
            {formatNumber(
              analytics.totals.duoMatches +
                analytics.totals.trioMatches +
                analytics.totals.fourStackMatches +
                analytics.totals.fullStackMatches,
            )}
          </strong>
          <small>{analytics.totals.fullStackMatches} full-stack games</small>
        </div>
      </section>

      <section className="stackBoard">
        <StackBoard
          title="Duo Queue"
          subtitle="Best two-player combinations"
          lineups={duoLineups}
          tone="gold"
        />
        <StackBoard
          title="Trio Queue"
          subtitle="Best three-player combinations"
          lineups={trioLineups}
          tone="sky"
        />
        <StackBoard
          title="Four-Stack"
          subtitle="Best four-person sets"
          lineups={fourLineups}
          tone="green"
        />
        <StackBoard
          title="Full Stack"
          subtitle="All five of you together"
          lineups={fullLineups}
          tone="danger"
        />
      </section>

      <section className="splitSection">
        <div className="panel">
          <h2>Stack Split</h2>
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
                <small>
                  {formatPercent(stack.winRate)} win | {formatDecimal(stack.kd)} K/D |{" "}
                  {formatNumber(stack.rpDelta)} RP
                </small>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Deep Stack Notes</h2>
          <div className="awards">
            {analytics.awards.map((award) => (
              <div className="award" key={award.title}>
                <span>{award.title}</span>
                <strong>{award.value}</strong>
                <small>{award.caption}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="chartGrid">
        <div className="panel chartPanel">
          <h2>Ranked Daily Trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.daily}>
              <CartesianGrid stroke="rgba(255,255,255,.12)" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0b8" />
              <YAxis stroke="#d8d0b8" />
              <Tooltip contentStyle={{ background: "#171713", border: "1px solid #393426" }} />
              <Bar dataKey="matches" fill="#66e0ff" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="panel chartPanel">
          <h2>Stack Heat</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.stackBreakdown}>
              <CartesianGrid stroke="rgba(255,255,255,.12)" vertical={false} />
              <XAxis dataKey="label" stroke="#d8d0b8" />
              <YAxis stroke="#d8d0b8" />
              <Tooltip contentStyle={{ background: "#171713", border: "1px solid #393426" }} />
              <Bar dataKey="matches" fill="#f5c542" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}

function StackBoard({
  title,
  subtitle,
  lineups,
  tone,
}: {
  title: string;
  subtitle: string;
  lineups: ReturnType<typeof buildStackAnalytics>["lineups"];
  tone: "gold" | "sky" | "green" | "danger";
}) {
  return (
    <section className={`panel stackBoardPanel tone-${tone}`}>
      <div className="stackBoardHeader">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="stackBoardGrid">
        {lineups.map((lineup) => (
          <a className="stackBoardCard" href="/" key={lineup.key}>
            <strong>{lineup.resultLabel}</strong>
            <span>
              {lineup.matches} matches | {formatPercent(lineup.winRate)} win
            </span>
            <small>
              {formatDecimal(lineup.kd)} K/D | {formatNumber(lineup.rpDelta)} RP
            </small>
          </a>
        ))}
      </div>
    </section>
  );
}
