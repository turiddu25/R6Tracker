import { NextResponse } from "next/server";
import { ingestMatches } from "@/lib/matchStore";
import type { IngestMatchSummary, MatchIngestPayload } from "@/lib/matchTypes";

export async function POST(request: Request) {
  const configuredToken = process.env.MATCH_INGEST_TOKEN;
  const providedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!configuredToken || providedToken !== configuredToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validationError = validatePayload(payload);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await ingestMatches(payload as MatchIngestPayload);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

function validatePayload(payload: unknown) {
  if (!isRecord(payload)) {
    return "Payload must be an object.";
  }

  if (!isNonEmptyString(payload.scraperRunId)) {
    return "scraperRunId is required.";
  }

  if (!isValidDate(payload.scrapedAt)) {
    return "scrapedAt must be an ISO date string.";
  }

  if (!Array.isArray(payload.matches) || payload.matches.length === 0) {
    return "matches must be a non-empty array.";
  }

  if (payload.matches.length > 50) {
    return "matches cannot contain more than 50 records per request.";
  }

  for (const match of payload.matches) {
    const error = validateMatch(match);

    if (error) {
      return error;
    }
  }

  return null;
}

function validateMatch(match: unknown) {
  if (!isRecord(match)) {
    return "Every match must be an object.";
  }

  const typed = match as Partial<IngestMatchSummary>;

  if (!["r6tracker", "statscc", "manual", "replay"].includes(String(typed.source))) {
    return "Invalid match source.";
  }

  if (!isValidDate(typed.startedAt)) {
    return "Every match needs a valid startedAt date.";
  }

  if (!isNonEmptyString(typed.seasonKey) || !isNonEmptyString(typed.seasonName)) {
    return "Every match needs seasonKey and seasonName.";
  }

  if (!["verified", "probable", "weak"].includes(String(typed.confidence))) {
    return "Invalid match confidence.";
  }

  if (!["win", "loss", "draw", "unknown"].includes(String(typed.result))) {
    return "Invalid match result.";
  }

  if (!Array.isArray(typed.players)) {
    return "Every match needs players.";
  }

  if (!isRecord(typed.stack)) {
    return "Every match needs stack summary.";
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}
