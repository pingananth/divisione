"use client";

import { useEffect, useState } from "react";
import { submitPlay } from "./actions";
import {
  DECISION_COUNT,
  decisionAt,
  pickEnding,
  recapCards,
  seedFor,
  shuffle,
  totalScore,
} from "@/lib/game/engine";
import { CONSEQUENCES, FINAL, OPENING, type Score } from "@/lib/game/scenario";

/*
 * Screens, in order:
 *   0 opening · 1 D1 · 2 C1 · 3 D2 · 4 C2 · 5 D3 · 6 C3 · 7 D4 · 8 C4
 *   9 ending · 10 recap · 11 final
 */
const ENDING_SCREEN = 1 + DECISION_COUNT * 2;
const RECAP_SCREEN = ENDING_SCREEN + 1;

type State = {
  screen: number;
  scores: Score[];
  playId: string;
  submitted: boolean;
};

const LETTERS = ["A", "B", "C", "D"];

function newPlayId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function freshState(): State {
  return { screen: 0, scores: [], playId: newPlayId(), submitted: false };
}

/** Storage can throw in private mode; the game must still work without it. */
function load(key: string): State | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}

function save(key: string, state: State) {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Refresh will restart the game; nothing else breaks.
  }
}

/**
 * Client-only (see PlayClient.tsx), so saved progress can be read straight into
 * the initial state: resume after an accidental refresh. Stage mode always
 * starts clean.
 */
export function Game({ round, stage = false }: { round: string; stage?: boolean }) {
  const storageKey = `ttl-game:${round}`;
  const [state, setState] = useState<State>(
    () => (stage ? null : load(storageKey)) ?? freshState(),
  );

  useEffect(() => {
    if (!stage) save(storageKey, state);
  }, [stage, storageKey, state]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.screen]);

  const next = () => {
    const screen = state.screen + 1;
    // Send the play to the projector tally once, as the ending is revealed.
    const submit = !stage && !state.submitted && screen === ENDING_SCREEN;
    if (submit) void submitPlay(round, state.playId, state.scores);
    setState({ ...state, screen, submitted: state.submitted || submit });
  };
  const choose = (score: Score) =>
    setState((s) => ({ ...s, scores: [...s.scores, score], screen: s.screen + 1 }));
  const restart = () => setState(freshState());

  const text = stage ? "text-2xl sm:text-3xl" : "text-lg";
  const shell = stage ? "mx-auto max-w-5xl px-6 py-10" : "mx-auto max-w-xl px-4 py-6";

  const { screen, scores } = state;
  let body: React.ReactNode;

  if (screen === 0) {
    body = (
      <Card>
        <h1 className={`font-bold text-ti-maroon ${stage ? "text-6xl" : "text-4xl"}`}>
          {OPENING.title}
        </h1>
        <p className={`mt-6 leading-relaxed text-zinc-700 ${text}`}>{OPENING.text}</p>
        <PrimaryButton onClick={next} stage={stage}>
          {OPENING.button}
        </PrimaryButton>
      </Card>
    );
  } else if (screen < ENDING_SCREEN && screen % 2 === 1) {
    const step = (screen - 1) / 2;
    const decision = decisionAt(step, scores);
    // Stage mode uses a fixed per-step seed so the facilitator's A–D letters
    // are the same on every rehearsal.
    const options = shuffle(decision.options, seedFor(stage ? "stage" : state.playId, step));
    body = (
      <Card>
        <Progress step={step} stage={stage} />
        <h2 className={`mt-3 font-bold text-ti-blue ${stage ? "text-4xl" : "text-2xl"}`}>
          {decision.title}
        </h2>
        <p className={`mt-4 leading-relaxed text-zinc-700 ${text}`}>{decision.text}</p>
        <div className={`mt-6 grid gap-3 ${stage ? "sm:grid-cols-2 sm:gap-4" : ""}`}>
          {options.map((opt, i) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => choose(opt.score)}
              className={`flex w-full items-start gap-3 rounded-xl border-2 border-zinc-200 bg-white text-left font-medium text-zinc-800 shadow-sm transition hover:border-ti-blue active:scale-[0.99] active:bg-ti-blue/5 ${
                stage ? "p-6 text-2xl" : "p-4 text-base"
              }`}
            >
              {stage ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ti-blue text-xl font-bold text-white">
                  {LETTERS[i]}
                </span>
              ) : null}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </Card>
    );
  } else if (screen < ENDING_SCREEN) {
    const step = (screen - 2) / 2;
    const isLast = step === DECISION_COUNT - 1;
    body = (
      <Card>
        <Progress step={step} stage={stage} />
        <p className={`mt-4 leading-relaxed text-zinc-800 ${text}`}>
          {CONSEQUENCES[step][scores[step]]}
        </p>
        <PrimaryButton onClick={next} stage={stage}>
          {isLast ? "Fast forward a year" : "Continue"}
        </PrimaryButton>
      </Card>
    );
  } else if (screen === ENDING_SCREEN) {
    const ending = pickEnding(totalScore(scores));
    body = (
      <div className="rounded-2xl bg-ti-maroon p-6 text-white shadow-sm sm:p-10">
        <p className={`italic text-ti-yellow ${text}`}>One year later…</p>
        <h1 className={`mt-3 font-extrabold leading-tight ${stage ? "text-7xl" : "text-5xl"}`}>
          {ending.title}
        </h1>
        <p className={`mt-6 leading-relaxed text-white/90 ${text}`}>{ending.text}</p>
        <button
          type="button"
          onClick={next}
          className={`mt-8 w-full rounded-xl bg-ti-yellow px-4 font-semibold text-zinc-900 shadow-sm transition hover:opacity-90 ${
            stage ? "py-5 text-2xl" : "py-4 text-lg"
          }`}
        >
          What did you gain?
        </button>
      </div>
    );
  } else if (screen === RECAP_SCREEN) {
    body = (
      <Card>
        <h2 className={`font-bold text-ti-blue ${stage ? "text-4xl" : "text-2xl"}`}>
          Your year, choice by choice
        </h2>
        <div className={`mt-6 grid gap-3 ${stage ? "sm:grid-cols-2 sm:gap-4" : ""}`}>
          {recapCards(scores).map((card) => (
            <div
              key={card.title}
              className={`rounded-xl border-l-4 p-4 ${
                card.gained
                  ? "border-ti-maroon bg-ti-yellow/30 text-zinc-900"
                  : "border-zinc-300 bg-zinc-100 text-zinc-500"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-widest">
                {card.gained ? "Gained" : "Missed"} · {card.title}
              </p>
              <p className={`mt-1 ${stage ? "text-xl" : "text-base"}`}>{card.text}</p>
            </div>
          ))}
        </div>
        <PrimaryButton onClick={next} stage={stage}>
          One last thing
        </PrimaryButton>
      </Card>
    );
  } else {
    body = (
      <div className="rounded-2xl bg-ti-blue p-6 text-white shadow-sm sm:p-10">
        <h1 className={`font-extrabold ${stage ? "text-7xl" : "text-5xl"}`}>{FINAL.title}</h1>
        <p className={`mt-6 leading-relaxed ${stage ? "text-3xl" : "text-xl"}`}>{FINAL.text}</p>
        {stage ? (
          <button
            type="button"
            onClick={restart}
            className="mt-10 text-sm text-white/60 underline hover:text-white"
          >
            Restart
          </button>
        ) : null}
      </div>
    );
  }

  return <main className={shell}>{body}</main>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">{children}</div>;
}

function Progress({ step, stage }: { step: number; stage: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <p
        className={`font-semibold uppercase tracking-widest text-zinc-500 ${
          stage ? "text-base" : "text-xs"
        }`}
      >
        Invitation {step + 1} of {DECISION_COUNT}
      </p>
      <div className="flex flex-1 gap-1" aria-hidden>
        {Array.from({ length: DECISION_COUNT }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-ti-maroon" : "bg-zinc-200"}`}
          />
        ))}
      </div>
    </div>
  );
}

function PrimaryButton({
  onClick,
  stage,
  children,
}: {
  onClick: () => void;
  stage: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-8 w-full rounded-xl bg-ti-maroon px-4 font-semibold text-white shadow-sm transition hover:opacity-90 ${
        stage ? "py-5 text-2xl" : "py-4 text-lg"
      }`}
    >
      {children}
    </button>
  );
}
