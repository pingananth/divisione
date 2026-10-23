"use client";

import { useId, useState } from "react";
import { searchClubs, type Club } from "@/lib/clubs";

/**
 * Club name with search-as-you-type over the District 229 club list.
 *
 * Picking a suggestion fills in the official name, but any text is kept as
 * typed: a club chartered after the list was taken still has to be enterable.
 * Follows the ARIA 1.2 combobox pattern so it works by keyboard and with a
 * screen reader.
 */
export function ClubCombobox({
  id,
  name,
  defaultValue = "",
  className,
  invalid,
  describedBy,
  onPick,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  className: string;
  invalid?: boolean;
  describedBy?: string;
  /** Called when a listed club is chosen, e.g. to fill in its division. */
  onPick?: (club: Club) => void;
}) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const results = open ? searchClubs(value) : [];
  const showList = open && value.trim() !== "";
  const optionId = (i: number) => `${listId}-${i}`;

  const pick = (club: Club) => {
    setValue(club.name);
    setOpen(false);
    setActive(-1);
    onPick?.(club);
  };

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        required
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder="Start typing your club's name"
        maxLength={120}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter" && showList && active >= 0 && results[active]) {
            // Pick the highlighted club instead of submitting the form.
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={className}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching clubs"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {results.map((club, i) => (
            <li
              key={club.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: it lands before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(club);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 ${
                i === active ? "bg-ti-blue/10 dark:bg-sky-400/15" : ""
              }`}
            >
              <span className="text-zinc-900 dark:text-zinc-100">{club.name}</span>
              <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">Div {club.division}</span>
            </li>
          ))}
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
              Not listed? Keep typing — we&apos;ll use the name as you type it.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
