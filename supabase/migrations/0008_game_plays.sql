-- "The Toastmaster Life" icebreaker game: one row per finished play.
--
-- Anonymous by design: no name, email or club. Only the four choices and the
-- ending, so the projector can show the room's spread during the debrief.

create table game_plays (
  id          uuid primary key default gen_random_uuid(),
  -- Groups plays per session, e.g. 'oct31' for the event and 'test' for dry runs.
  round       text not null check (round ~ '^[a-z0-9-]{1,32}$'),
  -- Random ID from the player's browser. Unique per round so a refresh or a
  -- double tap on the last screen is counted once.
  play_id     text not null check (char_length(play_id) between 8 and 64),

  d1          smallint not null check (d1 between 0 and 3),
  d2          smallint not null check (d2 between 0 and 3),
  d3          smallint not null check (d3 between 0 and 3),
  d4          smallint not null check (d4 between 0 and 3),
  ending      text not null check (ending in ('comfort', 'curious', 'connector', 'leader')),

  created_at  timestamptz not null default now()
);

create unique index game_plays_round_play on game_plays (round, play_id);

-- No policies: only the service role (server code) reads or writes.
alter table game_plays enable row level security;
