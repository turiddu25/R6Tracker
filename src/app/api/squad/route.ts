import { NextResponse } from "next/server";
import { getSquad } from "@/lib/store";

export async function GET() {
  const squad = await getSquad();

  return NextResponse.json(squad, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
