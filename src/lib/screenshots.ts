/** Private bucket for payment screenshots, created in migration 0006. */
export const SCREENSHOT_BUCKET = "payment-screenshots";

/** Under the 3 MB Server Action limit in next.config.ts, with room for form overhead. */
export const MAX_SCREENSHOT_BYTES = 2.5 * 1024 * 1024;

/** Accepted image types and the extension each is stored under. */
export const SCREENSHOT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** How long an organiser's "View screenshot" link works. */
export const SCREENSHOT_LINK_SECONDS = 10 * 60;
