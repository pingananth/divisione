"use client";

import { useEffect, useState } from "react";
import { ENDINGS, ENDING_ORDER, RECAP } from "@/lib/game/scenario";
import type { Tally } from "@/lib/game/plays";

const POLL_MS = 3000;

export function ResultsBoard({
  round,
  joinUrl,
  qrDataUrl,
}: {
  round: string;
  joinUrl: string;
  qrDataUrl: string;
}) {
  const [tally, setTally] = useState<Tally | null>(null);
  const [offline, setOffline] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/play/results/data?r=${encodeURIComponent(round)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Tally;
        if (alive) {
          setTally(data);
          setOffline(false);
        }
      } catch {
        if (alive) setOffline(true);
      }
    };
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [round]);

  const total = tally?.total ?? 0;
  const max = Math.max(1, ...ENDING_ORDER.map((id) => tally?.endings[id] ?? 0));

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-4xl font-bold text-ti-maroon">The Toastmaster Life</h1>
        <p className="text-sm text-zinc-500">
          Round <code>{round}</code>
          {offline ? <span className="ml-2 text-red-600">· reconnecting…</span> : null}
        </p>
      </header>

      {!revealed ? (
        <section className="mt-10 grid items-center gap-10 md:grid-cols-[auto_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR code to join the game"
            className="w-80 rounded-2xl bg-white p-4 shadow-sm"
          />
          <div>
            <p className="text-2xl text-zinc-600">Scan to play</p>
            <p className="mt-1 break-all text-xl font-semibold text-ti-blue">{joinUrl}</p>
            <p className="mt-10 text-8xl font-extrabold text-ti-maroon tabular-nums">{total}</p>
            <p className="text-2xl text-zinc-600">finished</p>
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-10 rounded-xl bg-ti-maroon px-8 py-4 text-xl font-semibold text-white shadow-sm hover:opacity-90"
            >
              Reveal results
            </button>
          </div>
        </section>
      ) : (
        <section className="mt-4">
          <p className="text-xl text-zinc-600">
            One year later… <span className="font-semibold tabular-nums">{total}</span> players
          </p>
          <div className="mt-4 space-y-3">
            {ENDING_ORDER.map((id) => {
              const n = tally?.endings[id] ?? 0;
              return (
                <div key={id}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-bold text-zinc-900">{ENDINGS[id].title}</p>
                    <p className="text-2xl font-bold tabular-nums text-ti-maroon">{n}</p>
                  </div>
                  <div className="mt-1 h-6 rounded-full bg-zinc-200">
                    <div
                      className="h-6 rounded-full bg-ti-maroon transition-all duration-700"
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="mt-8 text-xl font-semibold text-zinc-600">
            Who went outside their club, by decision
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            {RECAP.map((card, i) => {
              const pct = total ? Math.round(((tally?.outside[i] ?? 0) / total) * 100) : 0;
              return (
                <div key={card.title} className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                    {card.title}
                  </p>
                  <p className="mt-1 text-4xl font-extrabold tabular-nums text-ti-blue">{pct}%</p>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setRevealed(false)}
            className="mt-10 text-sm text-zinc-400 underline hover:text-zinc-600"
          >
            Back to QR
          </button>
        </section>
      )}
    </main>
  );
}
