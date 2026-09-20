import { describe, it, expect, afterEach, vi } from "vitest";
import { isDemoMode } from "./demo";

const setEnv = (values: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(values)) vi.stubEnv(k, v);
};

afterEach(() => vi.unstubAllEnvs());

describe("isDemoMode", () => {
  it("is on in development when Supabase is not configured", () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: undefined });
    expect(isDemoMode()).toBe(true);
  });

  it("is off whenever Supabase is configured", () => {
    setEnv({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" });
    expect(isDemoMode()).toBe(false);
  });

  it("stays off on a production build with no Supabase, so a misconfigured deploy cannot take real registrations into memory", () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: undefined, ALLOW_DEMO_MODE: undefined });
    expect(isDemoMode()).toBe(false);
  });

  it("can be opted into on a deployed preview on purpose", () => {
    setEnv({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: undefined, ALLOW_DEMO_MODE: "1" });
    expect(isDemoMode()).toBe(true);
  });

  it("ignores the opt-in once Supabase is configured", () => {
    setEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      ALLOW_DEMO_MODE: "1",
    });
    expect(isDemoMode()).toBe(false);
  });
});
