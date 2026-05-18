import type { FriendConfig } from "@/lib/types";

export const friends: FriendConfig[] = [
  {
    key: "mastercard",
    displayName: "MasterCard",
    nameOnPlatform: "MasterCard.",
    platformType: "uplay",
    platformFamily: "pc",
    accent: "#f5c542",
  },
  {
    key: "friend-two",
    displayName: "Friend Two",
    nameOnPlatform: "ReplaceMe",
    platformType: "uplay",
    platformFamily: "pc",
    accent: "#66e0ff",
  },
];

export const refreshCooldownMinutes = Number(
  process.env.REFRESH_COOLDOWN_MINUTES ?? 15,
);
