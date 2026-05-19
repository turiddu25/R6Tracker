import { NextResponse } from "next/server";
import { isWorkerAuthorized } from "@/lib/auth";
import { claimScraperJob } from "@/lib/scraperJobs";

export async function POST(request: Request) {
  if (!isWorkerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const job = await claimScraperJob();
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
