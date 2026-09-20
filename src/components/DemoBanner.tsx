import { isDemoMode } from "@/lib/demo";

/**
 * Makes demo mode impossible to mistake for the real thing. Nobody should ever
 * believe they have actually registered for a conference.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="bg-amber-100 dark:bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-200">
      <strong>Demo mode</strong> — no database connected. Nothing is saved, no email is sent, and
      the UPI ID is fake. Do not pay.
    </div>
  );
}
