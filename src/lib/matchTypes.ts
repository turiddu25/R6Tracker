export type MatchConfidence = "verified" | "probable" | "weak";

export type IngestMatchPlayer = {
  playerKey: string;
  displayName: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  rpDelta: number | null;
  team: string | null;
  result?: "win" | "loss" | "draw" | "unknown";
};

export type IngestStackSummary = {
  stackSize: number;
  stackPlayerKeys: string[];
  stackPlayerNames?: string[];
  isFullStack: boolean;
  confidence: MatchConfidence;
};

export type IngestMatchSummary = {
  source: "r6tracker" | "statscc" | "manual" | "replay";
  sourceMatchId: string | null;
  startedAt: string;
  seasonKey: string;
  seasonName: string;
  map: string | null;
  mode: string | null;
  playlist: string | null;
  score: string | null;
  result: "win" | "loss" | "draw" | "unknown";
  confidence: MatchConfidence;
  players: IngestMatchPlayer[];
  stack: IngestStackSummary;
};

export type MatchIngestPayload = {
  scraperRunId: string;
  scrapedAt: string;
  matches: IngestMatchSummary[];
};

export type StoredMatchSummary = IngestMatchSummary & {
  id: string;
  scraperRunId: string;
  ingestedAt: string;
  scrapedAt: string;
};
