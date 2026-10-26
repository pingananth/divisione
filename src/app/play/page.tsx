import { normaliseRound } from "@/lib/game/plays";
import { PlayClient } from "./PlayClient";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const { r } = await searchParams;
  return <PlayClient round={normaliseRound(r)} />;
}
