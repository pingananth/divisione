import Link from "next/link";

/**
 * The admin side is backed by Supabase Auth and row level security, so unlike
 * the member flow it cannot be faked convincingly in memory. Say so plainly
 * rather than throwing an environment-variable error at the organiser.
 */
export function DemoAdminNotice() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
      <div className="rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Admin needs a database</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          The organiser dashboard uses Supabase for sign-in and to keep each Division&apos;s data
          separate, so it cannot run in demo mode.
        </p>
        <p className="mt-3 text-zinc-600 dark:text-zinc-300">
          The member-facing flow works without any setup — try{" "}
          <Link className="text-ti-blue underline" href="/e/demo">
            the sample conference
          </Link>
          . To bring up the admin side, connect Supabase by following the README.
        </p>
      </div>
    </main>
  );
}
