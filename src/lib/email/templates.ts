import type { EmailMessage } from "./types";
import { formatPaise } from "../pricing";
import type { EventContact, InfoSection } from "../types";

export type TemplateName =
  | "registration_received"
  | "registration_confirmed"
  | "payment_needs_attention";

export type TemplateData = {
  fullName: string;
  eventTitle: string;
  eventVenue: string | null;
  eventStartsAt: string;
  ticketId: string;
  amountPaise: number;
  utr?: string;
  reason?: string;
  supportEmail: string;
  /** Optional so emails queued before these existed still render. */
  contacts?: EventContact[];
  infoSections?: InfoSection[];
};

/** "70107 37617" — matches how the web page writes it. */
const phoneText = (digits: string) =>
  /^\d{10}$/.test(digits) ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

/** Venues are stored as "Building | Floor | Street"; show one part per line. */
const venueParts = (venue: string) =>
  venue
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#71717a">Toastmasters District 229</p>
    <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3">${escapeHtml(heading)}</h1>
    ${bodyHtml}
  </div>
</body></html>`;
}

function detailRows(d: TemplateData): string {
  const rows: [string, string][] = [
    ["Event", d.eventTitle],
    ["When", d.eventStartsAt],
    ...(d.eventVenue ? ([["Where", d.eventVenue]] as [string, string][]) : []),
    ["Ticket ID", d.ticketId],
    ["Amount", formatPaise(d.amountPaise)],
    ...(d.utr ? ([["UPI reference", d.utr]] as [string, string][]) : []),
  ];
  return `<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#71717a;width:40%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:8px 0;font-weight:600">${
          k === "Where" ? venueParts(v).map(escapeHtml).join("<br>") : escapeHtml(v)
        }</td></tr>`,
    )
    .join("")}</table>`;
}

function detailText(d: TemplateData): string {
  const lines = [
    `Event: ${d.eventTitle}`,
    `When: ${d.eventStartsAt}`,
    ...(d.eventVenue ? [`Where: ${venueParts(d.eventVenue).join(", ")}`] : []),
    `Ticket ID: ${d.ticketId}`,
    `Amount: ${formatPaise(d.amountPaise)}`,
    ...(d.utr ? [`UPI reference: ${d.utr}`] : []),
  ];
  return lines.join("\n");
}

function contactsHtml(d: TemplateData): string {
  if (!d.contacts?.length) return "";
  const items = d.contacts
    .map(
      (c) =>
        `<li style="margin:0 0 6px">${escapeHtml(c.name)}${c.role ? ` <span style="color:#71717a">(${escapeHtml(c.role)})</span>` : ""} — <a href="tel:+91${escapeHtml(c.phone)}" style="color:#004165">${escapeHtml(phoneText(c.phone))}</a></li>`,
    )
    .join("");
  return `<p style="margin:20px 0 6px;font-size:14px;font-weight:600">Any queries? Reach out to</p><ul style="margin:0;padding-left:18px;font-size:14px">${items}</ul>`;
}

function contactsText(d: TemplateData): string {
  if (!d.contacts?.length) return "";
  return `\n\nAny queries? Reach out to\n${d.contacts
    .map((c) => `- ${c.name}${c.role ? ` (${c.role})` : ""}: ${phoneText(c.phone)}`)
    .join("\n")}`;
}

function sectionsHtml(d: TemplateData): string {
  if (!d.infoSections?.length) return "";
  return d.infoSections
    .map(
      (s) =>
        `<p style="margin:20px 0 6px;font-size:14px;font-weight:600">${escapeHtml(s.heading)}</p><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5">${s.items
          .map(
            (i) =>
              `<li style="margin:0 0 6px">${i.title ? `<strong>${escapeHtml(i.title)}:</strong> ` : ""}${escapeHtml(i.text)}</li>`,
          )
          .join("")}</ul>`,
    )
    .join("");
}

function sectionsText(d: TemplateData): string {
  if (!d.infoSections?.length) return "";
  return d.infoSections
    .map(
      (s) =>
        `\n\n${s.heading}\n${s.items.map((i) => `- ${i.title ? `${i.title}: ` : ""}${i.text}`).join("\n")}`,
    )
    .join("");
}

export function renderEmail(template: TemplateName, d: TemplateData): EmailMessage {
  const footerHtml = `${contactsHtml(d)}<p style="margin:24px 0 0;font-size:13px;color:#71717a">You can also reply to this email or write to ${escapeHtml(d.supportEmail)}.</p>`;
  const footerText = `${contactsText(d)}\n\nYou can also reply to this email or write to ${d.supportEmail}.`;

  switch (template) {
    case "registration_received":
      return {
        to: "",
        subject: `We have your registration for ${d.eventTitle}`,
        html: layout(
          `Thanks, ${d.fullName} — payment is being verified`,
          `<p style="margin:0;font-size:15px;line-height:1.6">We have received your registration and your UPI reference. We're checking your payment against our bank records and will email you as soon as it clears.</p>
           ${detailRows(d)}
           <p style="margin:0;font-size:15px;line-height:1.6">No action needed from you right now — please keep this email until your confirmation arrives.</p>
           ${footerHtml}`,
        ),
        text: `Thanks, ${d.fullName} — payment is being verified.

We have received your registration and your UPI reference. We're checking your payment against our bank records and will email you as soon as it clears.

${detailText(d)}

No action needed from you right now — please keep this email until your confirmation arrives.${footerText}`,
      };

    case "registration_confirmed":
      return {
        to: "",
        subject: `You're confirmed for ${d.eventTitle}`,
        html: layout(
          `You're confirmed, ${d.fullName}`,
          `<p style="margin:0;font-size:15px;line-height:1.6">Your payment has been matched against our bank records and your seat is confirmed. Please bring your Ticket ID to the registration desk.</p>
           ${detailRows(d)}
           ${sectionsHtml(d)}
           ${footerHtml}`,
        ),
        text: `You're confirmed, ${d.fullName}.

Your payment has been matched against our bank records and your seat is confirmed. Please bring your Ticket ID to the registration desk.

${detailText(d)}${sectionsText(d)}${footerText}`,
      };

    case "payment_needs_attention":
      return {
        to: "",
        subject: `Action needed for your ${d.eventTitle} registration`,
        html: layout(
          `${d.fullName}, we could not verify your payment yet`,
          `<p style="margin:0;font-size:15px;line-height:1.6">We were not able to match your payment against our bank statement.${d.reason ? ` ${escapeHtml(d.reason)}` : ""}</p>
           ${detailRows(d)}
           <p style="margin:0;font-size:15px;line-height:1.6">Please reply to this email with a screenshot of the payment from your UPI app so we can sort it out. Your registration is held until then.</p>
           ${footerHtml}`,
        ),
        text: `${d.fullName}, we could not verify your payment yet.

We were not able to match your payment against our bank statement.${d.reason ? ` ${d.reason}` : ""}

${detailText(d)}

Please reply to this email with a screenshot of the payment from your UPI app so we can sort it out. Your registration is held until then.${footerText}`,
      };
  }
}
