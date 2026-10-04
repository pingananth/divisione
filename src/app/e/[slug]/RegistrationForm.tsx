"use client";

import { startTransition, useActionState, useState } from "react";
import { registerAction, type RegisterState } from "./actions";
import {
  MEAL_PREFERENCES,
  TSHIRT_SIZES,
  ATTENDEE_TYPES,
  VEHICLE_TYPES,
  OWN_VEHICLES,
  GOV_ID_TYPES,
} from "@/lib/registration";
import type { CustomFieldKey } from "@/lib/types";
import { formatPaise } from "@/lib/pricing";

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";
const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 shadow-sm placeholder:text-zinc-400 outline-none focus:border-ti-blue focus:ring-2 focus:ring-ti-blue/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

function ErrorText({ name, error }: { name: string; error?: string }) {
  return error ? (
    <p id={`${name}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  ) : null;
}

function Field({
  name,
  label,
  error,
  hint,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
      <ErrorText name={name} error={error} />
    </div>
  );
}

/** A required single-choice question shown as tappable options. */
function Choice({
  name,
  legend,
  options,
  value,
  onChange,
  error,
  stacked = false,
}: {
  name: string;
  legend: string;
  /** One option per row, for longer labels such as ticket names with prices. */
  stacked?: boolean;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange?: (value: string) => void;
  error?: string;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className={labelClass}>{legend}</legend>
      <div className={`mt-2 grid gap-2 ${stacked ? "" : "sm:grid-cols-3"}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm has-[:checked]:border-ti-blue has-[:checked]:bg-ti-blue/5 dark:border-zinc-700 dark:has-[:checked]:border-sky-400 dark:has-[:checked]:bg-sky-400/10"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={value === o.value}
              onChange={() => onChange?.(o.value)}
              className="accent-ti-blue"
            />
            {o.label}
          </label>
        ))}
      </div>
      <ErrorText name={name} error={error} />
    </fieldset>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-ti-maroon px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Continue to payment"}
    </button>
  );
}

export function RegistrationForm({
  slug,
  enabledFields,
  tickets = [],
}: {
  slug: string;
  enabledFields: CustomFieldKey[];
  /** Tickets on sale right now. A choice is shown only when there is more than one. */
  tickets?: { id: string; label: string; amountPaise: number }[];
}) {
  const action = registerAction.bind(null, slug);
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(action, {});
  const errors = state.errors ?? {};
  // Echoed values back the inputs' defaults, so the form is also correct if
  // it remounts or JavaScript is off.
  const values = state.values ?? {};
  const has = (f: CustomFieldKey) => enabledFields.includes(f);
  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);

  // Tracked as they change: vehicle type decides whether to ask for a plate,
  // and ID type picks the example shown. The form is never reset (see
  // onSubmit), so these simply keep whatever the member last chose.
  const [vehicleType, setVehicleType] = useState(values.vehicleType ?? "");
  const [govIdType, setGovIdType] = useState(values.govIdType ?? "");
  const [tshirtSize, setTshirtSize] = useState(values.tshirtSize ?? "");

  const ownVehicle = OWN_VEHICLES.includes(vehicleType);
  const idPlaceholder = GOV_ID_TYPES.find((t) => t.value === govIdType)?.placeholder;

  return (
    <form
      action={formAction}
      // React 19 resets a form after its action runs, which wiped everything a
      // member had typed whenever one field had an error — and silently
      // cleared dropdowns, so fixing that one field failed again on the next
      // submit. Dispatching by hand skips the reset. `action` stays as the
      // fallback when JavaScript is off.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="space-y-5"
      noValidate
    >
      {state.formError ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
          {state.formError}
        </p>
      ) : null}

      {tickets.length > 1 ? (
        <Choice
          name="ticket"
          legend="Ticket"
          options={tickets.map((t) => ({ value: t.id, label: `${t.label} — ${formatPaise(t.amountPaise)}` }))}
          value={values.ticket ?? ""}
          error={errors.ticket}
          stacked
        />
      ) : null}

      <Field name="fullName" label="Full name" error={errors.fullName}>
        <input
          id="fullName"
          name="fullName"
          required
          autoComplete="name"
          defaultValue={values.fullName}
          aria-invalid={!!errors.fullName}
          aria-describedby={describedBy("fullName")}
          className={inputClass}
        />
      </Field>

      <Field name="email" label="Email" error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          defaultValue={values.email}
          aria-invalid={!!errors.email}
          aria-describedby={describedBy("email")}
          className={inputClass}
        />
      </Field>

      <Field name="phone" label="Mobile number" error={errors.phone}>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder="98765 43210"
          defaultValue={values.phone}
          aria-invalid={!!errors.phone}
          aria-describedby={describedBy("phone")}
          className={inputClass}
        />
      </Field>

      {has("attendeeType") ? (
        <Choice
          name="attendeeType"
          legend="Attending as"
          options={ATTENDEE_TYPES}
          value={values.attendeeType ?? ""}
          error={errors.attendeeType}
        />
      ) : null}

      {has("club") ? (
        <Field name="club" label="Club name" error={errors.club}>
          <input
            id="club"
            name="club"
            required
            defaultValue={values.club}
            aria-invalid={!!errors.club}
            aria-describedby={describedBy("club")}
            className={inputClass}
          />
        </Field>
      ) : null}

      {has("area") || has("division") ? (
        <div className="grid grid-cols-2 gap-4">
          {has("area") ? (
            <Field name="area" label="Area" error={errors.area}>
              <input
                id="area"
                name="area"
                required
                defaultValue={values.area}
                aria-invalid={!!errors.area}
                aria-describedby={describedBy("area")}
                className={inputClass}
              />
            </Field>
          ) : null}
          {has("division") ? (
            <Field name="division" label="Division" error={errors.division}>
              <input
                id="division"
                name="division"
                required
                defaultValue={values.division}
                aria-invalid={!!errors.division}
                aria-describedby={describedBy("division")}
                className={inputClass}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {has("mealPreference") ? (
        <Choice
          name="mealPreference"
          legend="Food preference"
          options={MEAL_PREFERENCES.map((m) => ({ value: m, label: m }))}
          value={values.mealPreference ?? ""}
          error={errors.mealPreference}
        />
      ) : null}

      {has("vehicle") ? (
        <div className="space-y-4">
          <Choice
            name="vehicleType"
            legend="How are you travelling?"
            options={VEHICLE_TYPES}
            value={vehicleType}
            onChange={setVehicleType}
            error={errors.vehicleType}
          />
          {ownVehicle ? (
            <Field
              name="vehicleNumber"
              label="Vehicle number"
              hint="Needed for parking at the venue."
              error={errors.vehicleNumber}
            >
              <input
                id="vehicleNumber"
                name="vehicleNumber"
                required
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="TN 09 AB 1234"
                defaultValue={values.vehicleNumber}
                aria-invalid={!!errors.vehicleNumber}
                aria-describedby={describedBy("vehicleNumber")}
                className={`${inputClass} uppercase`}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {has("governmentId") ? (
        <fieldset className="space-y-3">
          <legend className={labelClass}>Government ID</legend>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Shared only with the venue&apos;s security team for building entry. Please carry this ID
            on the day.
          </p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              <label htmlFor="govIdType" className="sr-only">
                ID type
              </label>
              <select
                id="govIdType"
                name="govIdType"
                required
                value={govIdType}
                onChange={(e) => setGovIdType(e.target.value)}
                aria-invalid={!!errors.govIdType}
                aria-describedby={describedBy("govIdType")}
                className={inputClass}
              >
                <option value="" disabled>
                  ID type…
                </option>
                {GOV_ID_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ErrorText name="govIdType" error={errors.govIdType} />
            </div>
            <div>
              <label htmlFor="govIdNumber" className="sr-only">
                ID number
              </label>
              <input
                id="govIdNumber"
                name="govIdNumber"
                required
                autoComplete="off"
                autoCapitalize="characters"
                placeholder={idPlaceholder ?? "ID number"}
                defaultValue={values.govIdNumber}
                aria-invalid={!!errors.govIdNumber}
                aria-describedby={describedBy("govIdNumber")}
                className={`${inputClass} uppercase`}
              />
              <ErrorText name="govIdNumber" error={errors.govIdNumber} />
            </div>
          </div>
        </fieldset>
      ) : null}

      {has("tshirtSize") ? (
        <Field name="tshirtSize" label="T-shirt size" error={errors.tshirtSize}>
          <select
            id="tshirtSize"
            name="tshirtSize"
            required
            value={tshirtSize}
            onChange={(e) => setTshirtSize(e.target.value)}
            aria-invalid={!!errors.tshirtSize}
            aria-describedby={describedBy("tshirtSize")}
            className={inputClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {TSHIRT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <SubmitButton pending={pending} />
    </form>
  );
}
