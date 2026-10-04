import type { RegistrationStatus } from "./types";

export type ReviewDecision = "confirmed" | "rejected";

/**
 * Why an organiser's manual decision cannot be applied, or null if it can.
 *
 * Only pending registrations are decided by hand — a stale tab must never flip
 * one that is already confirmed or rejected. Confirming someone who never gave
 * a UPI reference (cash at the desk, say) needs a note, so every confirmed
 * rupee stays traceable in the export.
 */
export function reviewProblem(input: {
  status: RegistrationStatus;
  hasUtr: boolean;
  decision: string;
  note: string;
}): string | null {
  if (input.decision !== "confirmed" && input.decision !== "rejected") {
    return "Choose confirm or reject.";
  }
  if (input.status !== "pending") {
    return `This registration was already ${input.status}.`;
  }
  if (input.decision === "confirmed" && !input.hasUtr && !input.note.trim()) {
    return "No UPI reference was submitted — add a note saying how they paid (e.g. cash at the desk).";
  }
  return null;
}
