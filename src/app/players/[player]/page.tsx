import { notFound } from "next/navigation";
import { friends } from "@/config/friends";
import PlayerClient from "./player-client";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ player: string }>;
}) {
  const { player } = await params;
  const friend = friends.find((entry) => entry.key === player);

  if (!friend) {
    notFound();
  }

  return <PlayerClient playerKey={friend.key} displayName={friend.displayName} accent={friend.accent} />;
}
