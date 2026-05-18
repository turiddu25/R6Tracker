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

export type NormalizedPlayerStats = {
  playerKey: string;
  displayName: string;
  username: string;
  platformType: PlatformType;
  platformFamily: PlatformFamily;
  accent: string;
  avatarUrl?: string;
  fetchedAt: string;
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
  rawSummary: Record<string, unknown>;
};

export type PlayerSnapshot = {
  playerKey: string;
  fetchedAt: string;
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
  source: "redis" | "live" | "empty";
  warnings: string[];
};

export type R6DataBundle = {
  stats: unknown;
  seasonalStats: unknown;
};
