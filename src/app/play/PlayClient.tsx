"use client";

import dynamic from "next/dynamic";

/**
 * The game reads saved progress from sessionStorage on its first render, so it
 * must not be server-rendered (the server has no storage to match).
 */
export const PlayClient = dynamic(() => import("./Game").then((m) => m.Game), {
  ssr: false,
  loading: () => <main className="mx-auto max-w-xl px-4 py-6" />,
});
