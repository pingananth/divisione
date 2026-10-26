import { headers } from "next/headers";
import QRCode from "qrcode";
import { normaliseRound } from "@/lib/game/plays";
import { ResultsBoard } from "./ResultsBoard";

export const dynamic = "force-dynamic";

export const metadata = { title: "The Toastmaster Life · Results" };

/** Projector view: join QR while people play, live ending bars for the debrief. */
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const { r } = await searchParams;
  const round = normaliseRound(r);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;
  const joinUrl = `${base}/play?r=${round}`;
  const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 480 });

  return <ResultsBoard round={round} joinUrl={joinUrl} qrDataUrl={qr} />;
}
