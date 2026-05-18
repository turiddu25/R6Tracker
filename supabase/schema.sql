create table if not exists latest_player_stats (
  player_key text primary key,
  display_name text not null,
  platform_type text not null,
  platform_family text not null,
  normalized jsonb not null,
  raw jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists player_stat_snapshots (
  id bigint generated always as identity primary key,
  player_key text not null,
  display_name text not null,
  platform_type text not null,
  platform_family text not null,
  normalized jsonb not null,
  raw jsonb not null,
  fetched_at timestamptz not null default now()
);

create index if not exists player_stat_snapshots_player_key_fetched_at_idx
  on player_stat_snapshots (player_key, fetched_at desc);

alter table latest_player_stats enable row level security;
alter table player_stat_snapshots enable row level security;

-- The app uses the service role key from server-side API routes, so no public RLS
-- policies are required for v1.
