import { redirect } from "next/navigation";
import { sessionClient, requireUser } from "@/lib/supabase-server";
import { isDemoMode } from "@/lib/demo";
import { DemoAdminNotice } from "@/components/DemoAdminNotice";

export const dynamic = "force-dynamic";

async function sendMagicLink(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) redirect("/admin/login?error=missing_email");

  const db = await sessionClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // Organisers are added to event_organisers deliberately; a stray sign-in
      // attempt should not create an account.
      shouldCreateUser: false,
    },
  });

  if (error) {
    console.error(`[admin/login] magic link failed for ${email}: ${error.message}`);
  }

  // Always report the same thing, so this page cannot be used to discover
  // which addresses are organisers.
  redirect("/admin/login?sent=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  if (isDemoMode()) return <DemoAdminNotice />;

  const { sent, error } = await searchParams;
  const { user } = await requireUser();
  if (user) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          District 229
        </p>
        <h1 className="mt-2 text-2xl font-bold">Organiser sign in</h1>

        {sent ? (
          <p className="mt-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
            If that address belongs to an organiser, a sign-in link is on its way. It expires in an
            hour.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              We&apos;ll email you a sign-in link. There is no password to remember or lose.
            </p>
            {error ? (
              <p className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/60 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error === "expired"
                  ? "That link has expired. Request a new one below."
                  : "Something went wrong. Please try again."}
              </p>
            ) : null}
            <form action={sendMagicLink} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm outline-none focus:border-ti-blue focus:ring-2 focus:ring-ti-blue/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-ti-maroon px-4 py-3 font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                Email me a sign-in link
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
