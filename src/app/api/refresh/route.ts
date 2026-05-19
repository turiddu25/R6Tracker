import { NextResponse } from "next/server";
import { refreshSquad } from "@/lib/store";

export async function POST() {
  const { squad, status } = await refreshSquad();
  const error = status === 429
    ? squad.cooldownEndsAt
      ? `Refresh cooldown active until ${formatDate(squad.cooldownEndsAt)}.`
      : "Refresh cooldown is active."
    : status === 502
      ? squad.warnings[squad.warnings.length - 1] ?? "Could not refresh R6Data."
      : null;

  return NextResponse.json(
    error ? { ...squad, error } : squad,
    {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
    },
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
