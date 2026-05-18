# R6 Friends Tracker

A private-by-convention Rainbow Six Siege squad dashboard for Vercel + Supabase.

## Setup

1. Create a free API key at <https://r6data.eu>.
2. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in the values.
4. Edit the friend list in `src/config/friends.ts`.
5. Install dependencies and run locally:

```powershell
npm install
npm run dev
```

## Deployment

Deploy to Vercel and add the same environment variables there. Keep `R6DATA_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only; never expose them as `NEXT_PUBLIC_*`.

The app serves cached Supabase data by default. The refresh button calls R6Data, updates the latest rows, and appends historical snapshots.
