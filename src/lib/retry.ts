/**
 * Re-run a read once more if it fails.
 *
 * Supabase occasionally answers a request with a slow 5xx — seen in testing
 * as a 10-second "Internal server error" that succeeded on the very next try.
 * On conference day that would show a member a crash page, so idempotent
 * reads get a second chance after a short pause.
 *
 * Each attempt gets its own abort signal, which `run` must attach to the query
 * (`.abortSignal(signal)`). That does two jobs:
 *   - It caps a hung attempt at `timeoutMs` instead of letting it stall.
 *   - It stops Next.js memoization from replaying the first failure. Next.js
 *     de-duplicates identical GET fetches within one page render, so without
 *     a fresh signal the "retry" silently returns the same cached error and
 *     never reaches the network. A signal opts the request out.
 *
 * Reads only. Never wrap a write in this: retrying an insert whose first
 * attempt actually landed would create a duplicate.
 *
 * `run` must build a fresh query each call — Supabase query builders are
 * single-use thenables.
 */
export async function retryRead<T extends { error: unknown }>(
  run: (signal: AbortSignal) => PromiseLike<T>,
  {
    attempts = 2,
    delayMs = 400,
    timeoutMs = 5000,
  }: { attempts?: number; delayMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  let result = await run(AbortSignal.timeout(timeoutMs));
  for (let attempt = 1; attempt < attempts && result.error; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    result = await run(AbortSignal.timeout(timeoutMs));
  }
  return result;
}
