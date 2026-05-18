import type { FriendConfig, R6DataBundle } from "@/lib/types";

const baseUrl = "https://api.r6data.eu/api/stats";

export async function fetchR6DataBundle(friend: FriendConfig): Promise<R6DataBundle> {
  const [stats, seasonalStats] = await Promise.all([
    fetchR6Data("stats", friend, { platform_families: friend.platformFamily }),
    fetchR6Data("seasonalStats", friend),
  ]);

  return { stats, seasonalStats };
}

async function fetchR6Data(
  type: string,
  friend: FriendConfig,
  extraParams: Record<string, string> = {},
) {
  const apiKey = process.env.R6DATA_API_KEY;

  if (!apiKey) {
    throw new Error("R6DATA_API_KEY is not configured.");
  }

  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    type,
    nameOnPlatform: friend.nameOnPlatform,
    platformType: friend.platformType,
    ...extraParams,
  }).toString();

  const response = await fetch(url, {
    headers: {
      "api-key": apiKey,
      accept: "application/json",
    },
    cache: "no-store",
  });

  const body = await safeJson(response);

  if (!response.ok) {
    throw new Error(
      `R6Data ${type} failed for ${friend.nameOnPlatform}: ${response.status} ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return { message: await response.text() };
  }
}
