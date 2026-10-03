import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/** Constant-time comparison, so the secret cannot be recovered by timing. */
export function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Gate a scheduled-job route behind CRON_SECRET, sent as
 * "Authorization: Bearer <secret>" by the Netlify scheduled functions.
 * Returns a response to send back when the caller is not allowed, or null
 * when the request may proceed.
 */
export function rejectUnlessCron(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return null;
}
