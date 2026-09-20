"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerAction, type RegisterState } from "./actions";
import { MEAL_PREFERENCES, TSHIRT_SIZES } from "@/lib/registration";
import type { CustomFieldKey } from "@/lib/types";

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";
const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 px-3 py-2 text-base text-zinc-900 shadow-sm placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:text-zinc-400 outline-none focus:border-ti-blue focus:ring-2 focus:ring-ti-blue/20";

function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
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
}: {
  slug: string;
  enabledFields: CustomFieldKey[];
}) {
  const action = registerAction.bind(null, slug);
  const [state, formAction] = useActionState<RegisterState, FormData>(action, {});
  const errors = state.errors ?? {};
  const has = (f: CustomFieldKey) => enabledFields.includes(f);

  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.formError ? (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/60 px-4 py-3 text-sm text-red-700 dark:text-red-300">{state.formError}</p>
      ) : null}

      <Field name="fullName" label="Full name" error={errors.fullName}>
        <input
          id="fullName"
          name="fullName"
          required
          autoComplete="name"
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
          aria-invalid={!!errors.phone}
          aria-describedby={describedBy("phone")}
          className={inputClass}
        />
      </Field>

      {has("club") ? (
        <Field name="club" label="Club name" error={errors.club}>
          <input
            id="club"
            name="club"
            required
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
                aria-invalid={!!errors.division}
                aria-describedby={describedBy("division")}
                className={inputClass}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {has("mealPreference") ? (
        <Field name="mealPreference" label="Meal preference" error={errors.mealPreference}>
          <select
            id="mealPreference"
            name="mealPreference"
            required
            defaultValue=""
            aria-invalid={!!errors.mealPreference}
            aria-describedby={describedBy("mealPreference")}
            className={inputClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {MEAL_PREFERENCES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {has("tshirtSize") ? (
        <Field name="tshirtSize" label="T-shirt size" error={errors.tshirtSize}>
          <select
            id="tshirtSize"
            name="tshirtSize"
            required
            defaultValue=""
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

      <SubmitButton />
    </form>
  );
}
