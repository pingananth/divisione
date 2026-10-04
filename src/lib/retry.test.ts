import { describe, it, expect, vi } from "vitest";
import { retryRead } from "./retry";

const ok = { data: "row", error: null };
const fail = { data: null, error: { message: "Internal server error" } };

describe("retryRead", () => {
  it("returns straight away when the first try works", async () => {
    const run = vi.fn(async () => ok);
    expect(await retryRead(run, { delayMs: 0 })).toBe(ok);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("recovers from a one-off failure", async () => {
    const run = vi.fn().mockResolvedValueOnce(fail).mockResolvedValueOnce(ok);
    expect(await retryRead(run, { delayMs: 0 })).toBe(ok);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("gives up after the allowed attempts and returns the last error", async () => {
    const run = vi.fn(async () => fail);
    expect(await retryRead(run, { delayMs: 0 })).toBe(fail);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("gives every attempt its own abort signal", async () => {
    const signals: AbortSignal[] = [];
    await retryRead(
      async (signal) => {
        signals.push(signal);
        return fail;
      },
      { delayMs: 0 },
    );
    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
  });

  it("cuts off a hung attempt and retries it", async () => {
    let calls = 0;
    const run = (signal: AbortSignal): Promise<typeof fail | typeof ok> => {
      calls++;
      if (calls === 1) {
        return new Promise<typeof fail>((resolve) =>
          signal.addEventListener("abort", () => resolve({ ...fail, error: { message: "aborted" } })),
        );
      }
      return Promise.resolve(ok);
    };
    expect(await retryRead(run, { delayMs: 0, timeoutMs: 20 })).toBe(ok);
    expect(calls).toBe(2);
  });

  it("builds a fresh query for every attempt", async () => {
    let built = 0;
    const run = () => {
      built++;
      return Promise.resolve<typeof fail | typeof ok>(built === 1 ? fail : ok);
    };
    await retryRead(run, { delayMs: 0 });
    expect(built).toBe(2);
  });
});
