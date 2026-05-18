# R6 Friends Tracker

A private-by-convention Rainbow Six Siege squad dashboard for Vercel + Upstash Redis.

## Setup

1. Create a free API key at <https://r6data.eu>.
2. In Vercel Marketplace, add Upstash Redis to the project.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Edit the friend list in `src/config/friends.ts`.
5. Install dependencies and run locally:

```powershell
npm install
npm run dev
```

## Before pushing

Run the fast local gate every time:

```powershell
npm run verify
```

Before pushing to Vercel, run the full production check:

```powershell
npm run prepush
```

If `npm run dev` or `npm run build` fails with `spawn EPERM` inside Codex, run it from your normal PowerShell/VS Code terminal. Next.js spawns worker Node processes and the Codex sandbox can block that, even when the app itself is valid.

## Deployment

Deploy to Vercel and add the same environment variables there. Keep `R6DATA_API_KEY` and `KV_REST_API_TOKEN` server-only; never expose them as `NEXT_PUBLIC_*`.

Vercel's Upstash integration usually creates `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. The app also accepts `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if you prefer those names.

The app serves cached Redis data by default. The refresh button calls R6Data, updates the latest squad cache, and appends historical snapshots.
