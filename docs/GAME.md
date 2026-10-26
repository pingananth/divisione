# Icebreaker game: "The Toastmaster Life"

A 4-minute phone scenario game for the conference floor (Exuberance'26, Oct 31). Its real theme,
"Beyond the Club", is only named on the last screen, so the debrief lands as a reveal.

Script, scoring and endings live in `src/lib/game/`.

| Path | What |
| --- | --- |
| `/play?r=<round>` | The game. Share as a QR. `r` keeps dry runs (`r=test`) apart from the event (`r=oct31`). |
| `/play/results?r=<round>` | Projector: join QR and a live "finished" count, then **Reveal results** for the debrief. |
| `/play/stage` | No-network fallback: one path on the big screen, room votes A–D, nothing recorded. |

## Setup

Run `supabase/migrations/0008_game_plays.sql` in the Supabase SQL editor. Without Supabase the game
runs in demo mode and keeps the tally in memory.

## Data

Plays are anonymous: four choices (0–3) and an ending. No names, emails or clubs. Each phone counts
once per round. The server recomputes the ending from the choices.

## Debrief (about 5 minutes)

1. Reveal results on the projector. Hands up by ending.
2. Ask one Comfort Zone Champion and one Leader in the Making which decision was hardest, and why.
3. A District leader shares one moment outside their own club that changed their journey.
4. Read the final screen aloud. Give 60 seconds to swap numbers with someone from another club.
