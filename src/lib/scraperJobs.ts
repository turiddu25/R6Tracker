import { getRedis } from "@/lib/redis";

export type ScraperJobStatus = "idle" | "queued" | "running" | "success" | "failed";

export type ScraperJob = {
  id: string;
  status: ScraperJobStatus;
  requestedAt: string;
  requestedBy: "admin";
  claimedAt: string | null;
  finishedAt: string | null;
  message: string | null;
  runId: string | null;
};

const currentJobKey = "r6:scraper:job:current";
const latestJobKey = "r6:scraper:job:latest";

export async function createScraperJob() {
  const redis = requireRedis();
  const existing = await redis.get<ScraperJob>(currentJobKey);

  if (existing && (existing.status === "queued" || existing.status === "running")) {
    return existing;
  }

  const job: ScraperJob = {
    id: crypto.randomUUID(),
    status: "queued",
    requestedAt: new Date().toISOString(),
    requestedBy: "admin",
    claimedAt: null,
    finishedAt: null,
    message: "Queued from admin panel.",
    runId: null,
  };

  await Promise.all([redis.set(currentJobKey, job), redis.set(latestJobKey, job)]);

  return job;
}

export async function getLatestScraperJob() {
  const redis = requireRedis();

  return (await redis.get<ScraperJob>(latestJobKey)) ?? null;
}

export async function claimScraperJob() {
  const redis = requireRedis();
  const job = await redis.get<ScraperJob>(currentJobKey);

  if (!job || job.status !== "queued") {
    return null;
  }

  const claimed: ScraperJob = {
    ...job,
    status: "running",
    claimedAt: new Date().toISOString(),
    message: "Mini PC worker claimed job.",
  };

  await Promise.all([redis.set(currentJobKey, claimed), redis.set(latestJobKey, claimed)]);

  return claimed;
}

export async function finishScraperJob(update: {
  id: string;
  status: "success" | "failed";
  message: string;
  runId?: string | null;
}) {
  const redis = requireRedis();
  const current = await redis.get<ScraperJob>(currentJobKey);

  if (!current || current.id !== update.id) {
    throw new Error("Job not found or no longer current.");
  }

  const finished: ScraperJob = {
    ...current,
    status: update.status,
    finishedAt: new Date().toISOString(),
    message: update.message,
    runId: update.runId ?? current.runId,
  };

  await Promise.all([
    redis.set(latestJobKey, finished),
    redis.del(currentJobKey),
  ]);

  return finished;
}

function requireRedis() {
  const redis = getRedis();

  if (!redis) {
    throw new Error("Upstash Redis is not configured.");
  }

  return redis;
}
