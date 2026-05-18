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
    key: "maestro",
    displayName: "Maestro",
    nameOnPlatform: "Maestro.-",
    platformType: "uplay",
    platformFamily: "pc",
    accent: "#66e0ff",
  },
  {
    key: "paypal",
    displayName: "PayPal",
    nameOnPlatform: "PayPaI.",
    platformType: "uplay",
    platformFamily: "pc",
    accent: "#4f8cff",
  },
  {
    key: "visa",
    displayName: "VISA",
    nameOnPlatform: "VlSA.",
    platformType: "uplay",
    platformFamily: "pc",
    accent: "#f26d50",
  },
  {
    key: "postepay",
    displayName: "PostePay",
    nameOnPlatform: "PostePay.",
    platformType: "uplay",
    platformFamily: "pc",
    accent: "#8fff6a",
  },
];

export const refreshCooldownMinutes = Number(
  process.env.REFRESH_COOLDOWN_MINUTES ?? 15,
);
