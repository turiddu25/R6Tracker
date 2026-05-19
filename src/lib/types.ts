export type PlatformType = "uplay" | "psn" | "xbl" | "steam";
export type PlatformFamily = "pc" | "console";

export type FriendConfig = {
  key: string;
  displayName: string;
  nameOnPlatform: string;
  platformType: PlatformType;
  platformFamily: PlatformFamily;
  accent: string;
  avatarUrl?: string;
};

export type StatValue = number | null;

export type OperatorStat = {
  operator: string;
  side: string | null;
  roundsPlayed: number | null;
  matchesPlayed: number | null;
  matchesWon: number | null;
  matchesLost: number | null;
  winPercent: number | null;
  matchWinPercent: number | null;
  kd: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  headshotPercent: number | null;
  headshots: number | null;
  timePlayed: string | null;
  timePlayedMs: number | null;
  clutches: number | null;
  clutchesLost: number | null;
  firstBloods: number | null;
  firstDeaths: number | null;
  teamKills: number | null;
};

export type NormalizedPlayerStats = {
  playerKey: string;
  displayName: string;
  username: string;
  platformType: PlatformType;
  platformFamily: PlatformFamily;
  accent: string;
  avatarUrl?: string;
  fetchedAt: string;
  seasonKey: string;
  seasonName: string;
  rank: string | null;
  rankImageUrl: string | null;
  rankPoints: StatValue;
  peakRankPoints: StatValue;
  kd: StatValue;
  winRate: StatValue;
  matches: StatValue;
  wins: StatValue;
  losses: StatValue;
  kills: StatValue;
  deaths: StatValue;
  assists: StatValue;
  headshots: StatValue;
  headshotRate: StatValue;
  playtimeHours: StatValue;
  operators: OperatorStat[];
  rawSummary: Record<string, unknown>;
};

export type PlayerSnapshot = {
  playerKey: string;
  fetchedAt: string;
  seasonKey: string;
  seasonName: string;
  kd: StatValue;
  winRate: StatValue;
  rankPoints: StatValue;
  matches: StatValue;
};

export type SquadResponse = {
  players: NormalizedPlayerStats[];
  history: PlayerSnapshot[];
  canRefresh: boolean;
  cooldownEndsAt: string | null;
  lastUpdatedAt: string | null;
  activeSeasonKey: string;
  activeSeasonName: string;
  source: "redis" | "live" | "empty";
  warnings: string[];
};

export type R6DataBundle = {
  stats: unknown;
  seasonalStats: unknown;
  operatorStats: unknown;
};
