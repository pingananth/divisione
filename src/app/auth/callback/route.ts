import { NextResponse, type NextRequest } from "next/server";
import { sessionClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** Completes the magic-link sign-in and drops the organiser at the dashboard. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=missing_code`);
  }

  const db = await sessionClient();
  const { error } = await db.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/admin/login?error=expired`);
  }

  // Only ever redirect within this site; an open redirect here would let a
  // crafted link bounce a signed-in organiser to an attacker's page.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  return NextResponse.redirect(`${origin}${target}`);
}
