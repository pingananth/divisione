import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase-server";
import { isDemoMode } from "@/lib/demo";
import { DemoAdminNotice } from "@/components/DemoAdminNotice";
import { formatEventDate } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (isDemoMode()) return <DemoAdminNotice />;

  const { db, user } = await requireUser();
  if (!user) redirect("/admin/login");

  // RLS limits this to events this organiser actually runs.
  const { data, error } = await db
    .from("events")
    .select("slug, title, starts_at, registration_open")
    .order("starts_at", { ascending: true });

  if (error) throw new Error(`Failed to load events: ${error.message}`);
  const events = data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Your conferences</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Signed in as {user.email}</p>

      {events.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-6 text-zinc-600 dark:text-zinc-300 shadow-sm">
          You are not listed as an organiser for any conference yet. Ask the District admin to add
          you.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {events.map((e) => (
            <li key={e.slug}>
              <Link
                href={`/admin/${e.slug}`}
                className="flex items-center justify-between rounded-2xl bg-white ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 p-5 shadow-sm transition hover:shadow"
              >
                <span>
                  <span className="block font-semibold">{e.title}</span>
                  <span className="block text-sm text-zinc-500 dark:text-zinc-400">
                    {formatEventDate(e.starts_at)}
                  </span>
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    e.registration_open
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:text-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {e.registration_open ? "Open" : "Closed"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
