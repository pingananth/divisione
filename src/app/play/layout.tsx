import type { Metadata } from "next";
import { GAME_TITLE } from "@/lib/game/scenario";

// Deliberately neutral: the real theme is the final screen's reveal.
export const metadata: Metadata = {
  title: GAME_TITLE,
  description: "Four invitations. One year. Where will you end up?",
};

/**
 * The site shell is dark; the game is a light stage so it reads well on phones
 * held up in a hall and on a washed-out projector.
 */
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 bg-zinc-100 text-zinc-900">{children}</div>;
}
