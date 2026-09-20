import type { Config } from "@netlify/functions";

/**
 * Drains the confirmation-email queue on a schedule.
 *
 * Calls the app's own /api/cron/outbox route rather than duplicating its logic,
 * so the same endpoint stays usable for a manual "send now" from the admin.
 *
 * Netlify only runs scheduled functions on a deployed production site — this
 * will never fire during local development.
 */
const drainOutbox = async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.error("[outbox-cron] URL or CRON_SECRET is not set; skipping run");
    return;
  }

  const response = await fetch(`${base}/api/cron/outbox`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`[outbox-cron] failed: HTTP ${response.status} ${body}`);
    return;
  }

  console.log(`[outbox-cron] ${body}`);
};

export default drainOutbox;

export const config: Config = {
  schedule: "*/10 * * * *",
};
