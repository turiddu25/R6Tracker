import { NextResponse } from "next/server";
import { refreshSquad } from "@/lib/store";

export async function POST() {
  const { squad, status } = await refreshSquad();

  return NextResponse.json(squad, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
