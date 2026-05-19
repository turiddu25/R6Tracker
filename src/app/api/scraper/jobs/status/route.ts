import { NextResponse } from "next/server";
import { isWorkerAuthorized } from "@/lib/auth";
import { finishScraperJob } from "@/lib/scraperJobs";

export async function POST(request: Request) {
  if (!isWorkerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isStatusBody(body)) {
    return NextResponse.json({ error: "Invalid status payload" }, { status: 400 });
  }

  try {
    const job = await finishScraperJob(body);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

function isStatusBody(value: unknown): value is {
  id: string;
  status: "success" | "failed";
  message: string;
  runId?: string | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    (record.status === "success" || record.status === "failed") &&
    typeof record.message === "string"
  );
}
