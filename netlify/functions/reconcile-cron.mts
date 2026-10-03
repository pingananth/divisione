import type { Config } from "@netlify/functions";

/**
 * Re-runs payment matching for active conferences every 5 minutes, so a
 * claim moves from "waiting" to "needs review" on time without anyone
 * clicking anything.
 *
 * Netlify only runs scheduled functions on a deployed production site — this
 * never fires during local development.
 */
const runMatching = async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.error("[reconcile-cron] URL or CRON_SECRET is not set; skipping run");
    return;
  }

  const response = await fetch(`${base}/api/cron/reconcile`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`[reconcile-cron] failed: HTTP ${response.status} ${body}`);
    return;
  }

  console.log(`[reconcile-cron] ${body}`);
};

export default runMatching;

export const config: Config = {
  schedule: "*/5 * * * *",
};
