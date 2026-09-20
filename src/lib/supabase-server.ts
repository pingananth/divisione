import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Request-scoped client carrying the organiser's session.
 *
 * Unlike `serviceClient()`, this one is subject to row level security, so
 * every query it makes is automatically limited to the events that organiser
 * actually runs. Admin reads go through here precisely so one Division cannot
 * see another Division's registrant list even if a route forgets to filter.
 */
export async function sessionClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");

  const store = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware instead.
        }
      },
    },
  });
}

export async function requireUser() {
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return { db, user };
}
