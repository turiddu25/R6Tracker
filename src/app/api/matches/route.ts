import { NextResponse } from "next/server";
import { getSeasonForDate } from "@/config/seasons";
import { getStoredMatches } from "@/lib/matchStore";

export async function GET() {
  const activeSeason = getSeasonForDate();
  const matches = await getStoredMatches(activeSeason.key);

  return NextResponse.json(
    {
      activeSeasonKey: activeSeason.key,
      activeSeasonName: activeSeason.name,
      matches,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
