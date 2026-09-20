import { notFound, redirect } from "next/navigation";
import { isDemoMode, DEMO_SLUG } from "@/lib/demo";

export const dynamic = "force-dynamic";

/**
 * Convenience redirect. The sample conference actually lives at /e/demo, but
 * /demo is the natural guess and the site's home page redirects elsewhere, so
 * there is otherwise no way to find it without being told the exact URL.
 *
 * Once Supabase is configured there is no sample conference, so this 404s
 * rather than bouncing to a dead page.
 */
export default function DemoRedirect() {
  if (!isDemoMode()) notFound();
  redirect(`/e/${DEMO_SLUG}`);
}
