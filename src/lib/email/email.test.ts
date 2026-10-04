import { describe, it, expect, vi } from "vitest";
import { createEmailProvider, SUPPORTED_PROVIDERS } from "./index";
import { renderEmail, type TemplateData } from "./templates";
import { processOutbox, backoffMs, outboxKey, type OutboxStore, type OutboxEntry } from "./outbox";
import type { EmailProvider, SendResult } from "./types";
import { classifyHttpFailure } from "./types";

const data: TemplateData = {
  fullName: "Asha Rao",
  eventTitle: "Division E Conference 2026",
  eventVenue: "Chennai Trade Centre",
  eventStartsAt: "4 October 2026, 9:00 AM",
  ticketId: "ABC123",
  amountPaise: 30000,
  supportEmail: "divisione@d229.org",
};

describe("createEmailProvider", () => {
  it("defaults to the console provider so local runs never email members", () => {
    expect(createEmailProvider({}).name).toBe("console");
  });

  it("selects each supported provider by name", () => {
    expect(
      createEmailProvider({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "k", EMAIL_FROM: "a@b.c" })
        .name,
    ).toBe("resend");
    expect(
      createEmailProvider({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "k", EMAIL_FROM: "a@b.c" }).name,
    ).toBe("brevo");
    expect(
      createEmailProvider({ EMAIL_PROVIDER: "smtp", SMTP_HOST: "h", EMAIL_FROM: "a@b.c" }).name,
    ).toBe("smtp");
  });

  it("is case-insensitive about the provider name", () => {
    expect(createEmailProvider({ EMAIL_PROVIDER: "CONSOLE" }).name).toBe("console");
  });

  it("names the supported providers when given an unknown one", () => {
    expect(() => createEmailProvider({ EMAIL_PROVIDER: "mailchimp" })).toThrow(/Supported: /);
  });

  it("fails loudly when a selected provider is missing credentials", () => {
    expect(() => createEmailProvider({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "a@b.c" })).toThrow(
      /RESEND_API_KEY/,
    );
    expect(() => createEmailProvider({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "k" })).toThrow(
      /EMAIL_FROM/,
    );
  });

  it("exposes every provider the factory can build", () => {
    expect([...SUPPORTED_PROVIDERS]).toEqual(["resend", "brevo", "smtp", "console"]);
  });
});

describe("classifyHttpFailure", () => {
  it("treats rate limits and server errors as retryable", () => {
    expect(classifyHttpFailure(429, "slow down")).toMatchObject({ retryable: true });
    expect(classifyHttpFailure(503, "down")).toMatchObject({ retryable: true });
  });

  it("treats client errors as permanent", () => {
    expect(classifyHttpFailure(401, "bad key")).toMatchObject({ retryable: false });
    expect(classifyHttpFailure(422, "bad address")).toMatchObject({ retryable: false });
  });
});

describe("renderEmail", () => {
  it("renders all three templates with subject, html and text", () => {
    const templates = [
      "registration_received",
      "registration_confirmed",
      "payment_needs_attention",
    ] as const;
    for (const t of templates) {
      const m = renderEmail(t, data);
      expect(m.subject).toContain("Division E Conference 2026");
      expect(m.html).toContain("Asha Rao");
      expect(m.text).toContain("Asha Rao");
      expect(m.text).toContain("ABC123");
    }
  });

  it("formats the amount in rupees", () => {
    expect(renderEmail("registration_confirmed", data).text).toContain("₹300");
  });

  it("includes the UPI reference only when one is known", () => {
    expect(renderEmail("registration_confirmed", data).text).not.toContain("UPI reference");
    expect(renderEmail("registration_confirmed", { ...data, utr: "412345678901" }).text).toContain(
      "412345678901",
    );
  });

  it("omits the venue line when the event has no venue", () => {
    expect(renderEmail("registration_confirmed", { ...data, eventVenue: null }).text).not.toContain(
      "Where:",
    );
  });

  it("escapes HTML so a name cannot inject markup", () => {
    const hostile = "<script>alert(1)</script>";
    const m = renderEmail("registration_confirmed", { ...data, fullName: hostile });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
});

describe("backoffMs", () => {
  it("grows exponentially from one minute", () => {
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
  });

  it("caps at one hour", () => {
    expect(backoffMs(20)).toBe(3_600_000);
  });
});

describe("outboxKey", () => {
  it("is stable per registration and template", () => {
    expect(outboxKey("r1", "registration_confirmed")).toBe("r1:registration_confirmed");
  });
});

function fakeStore(entries: OutboxEntry[]) {
  const calls = {
    sent: [] as string[],
    retried: [] as [string, number][],
    failed: [] as [string, string][],
  };
  const store: OutboxStore = {
    async claimDue(limit) {
      return entries.slice(0, limit);
    },
    async markSent(id) {
      calls.sent.push(id);
    },
    async markRetry(id, attempts) {
      calls.retried.push([id, attempts]);
    },
    async markFailed(id, error) {
      calls.failed.push([id, error]);
    },
  };
  return { store, calls };
}

const entry = (id: string, attempts = 0): OutboxEntry => ({
  id,
  registrationId: id,
  idempotencyKey: `${id}:registration_confirmed`,
  to: "asha@example.com",
  template: "registration_confirmed",
  data,
  attempts,
  nextAttemptAt: "2026-09-20T00:00:00Z",
});

function fakeProvider(results: SendResult[]): EmailProvider {
  let i = 0;
  return {
    name: "fake",
    async verify() {
      return { ok: true, detail: "fake" };
    },
    async send() {
      return results[Math.min(i++, results.length - 1)];
    },
  };
}

describe("processOutbox", () => {
  it("sends due entries and marks them sent", async () => {
    const { store, calls } = fakeStore([entry("a"), entry("b")]);
    const summary = await processOutbox(
      store,
      fakeProvider([{ ok: true, providerMessageId: "m1" }]),
    );
    expect(summary).toEqual({ sent: 2, retried: 0, failed: 0 });
    expect(calls.sent).toEqual(["a", "b"]);
  });

  it("addresses each message to the entry's recipient", async () => {
    const { store } = fakeStore([entry("a")]);
    const send = vi.fn(async () => ({ ok: true, providerMessageId: null }) as SendResult);
    await processOutbox(store, {
      name: "spy",
      verify: async () => ({ ok: true, detail: "" }),
      send,
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "asha@example.com" }));
  });

  it("schedules a retry on a transient failure", async () => {
    const { store, calls } = fakeStore([entry("a")]);
    const summary = await processOutbox(
      store,
      fakeProvider([{ ok: false, error: "429", retryable: true }]),
    );
    expect(summary).toEqual({ sent: 0, retried: 1, failed: 0 });
    expect(calls.retried).toEqual([["a", 1]]);
  });

  it("fails immediately on a permanent error rather than burning quota", async () => {
    const { store, calls } = fakeStore([entry("a")]);
    const summary = await processOutbox(
      store,
      fakeProvider([{ ok: false, error: "401 bad key", retryable: false }]),
    );
    expect(summary).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(calls.failed[0][1]).toContain("401 bad key");
  });

  it("gives up once max attempts is reached", async () => {
    const { store, calls } = fakeStore([entry("a", 5)]);
    const summary = await processOutbox(
      store,
      fakeProvider([{ ok: false, error: "503", retryable: true }]),
      { maxAttempts: 6 },
    );
    expect(summary).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(calls.failed[0][1]).toMatch(/gave up after 6 attempts/);
  });

  it("respects the batch limit", async () => {
    const { store, calls } = fakeStore([entry("a"), entry("b"), entry("c")]);
    await processOutbox(store, fakeProvider([{ ok: true, providerMessageId: null }]), { limit: 2 });
    expect(calls.sent).toHaveLength(2);
  });

  it("does nothing when nothing is due", async () => {
    const { store } = fakeStore([]);
    expect(
      await processOutbox(store, fakeProvider([{ ok: true, providerMessageId: null }])),
    ).toEqual({ sent: 0, retried: 0, failed: 0 });
  });
});

describe("email content", () => {
  const rich: TemplateData = {
    ...data,
    eventVenue: "Lennox India Technology Centre | Zenith - 10th floor | Tharamani, Chennai",
    contacts: [
      { name: "TM Kowsalya", role: "Conference Chair", phone: "7010737617" },
      { name: "TM Rajan", role: "Registration Chair", phone: "8883388222" },
    ],
    infoSections: [
      { heading: "Do's", tone: "do", items: [{ title: "Credentials & ID", text: "Carry your Government ID." }] },
    ],
  };

  it("puts each part of the venue on its own line", () => {
    const m = renderEmail("registration_confirmed", rich);
    expect(m.html).toContain("Lennox India Technology Centre<br>Zenith - 10th floor<br>Tharamani, Chennai");
    expect(m.text).toContain("Where: Lennox India Technology Centre, Zenith - 10th floor, Tharamani, Chennai");
    expect(m.html).not.toContain(" | ");
  });

  it("lists every contact with role and a tap-to-call link", () => {
    for (const t of ["registration_received", "registration_confirmed", "payment_needs_attention"] as const) {
      const m = renderEmail(t, rich);
      expect(m.html).toContain('href="tel:+918883388222"');
      expect(m.text).toContain("TM Rajan (Registration Chair): 88833 88222");
      expect(m.text).toContain("TM Kowsalya (Conference Chair): 70107 37617");
    }
  });

  it("includes Do's and Don'ts in the confirmation only", () => {
    expect(renderEmail("registration_confirmed", rich).text).toContain("Credentials & ID: Carry your Government ID.");
    expect(renderEmail("registration_received", rich).text).not.toContain("Credentials & ID");
  });

  it("renders without the optional blocks for older queued emails", () => {
    const m = renderEmail("registration_confirmed", data);
    expect(m.text).not.toContain("Any queries");
    expect(m.text).toContain("You can also reply to this email");
  });

  it("no longer promises a day-or-two wait", () => {
    expect(renderEmail("registration_received", data).text).not.toMatch(/day or two/);
  });

  it("escapes contact and guideline text", () => {
    const m = renderEmail("registration_confirmed", {
      ...rich,
      contacts: [{ name: "<b>x</b>", phone: "7010737617" }],
      infoSections: [{ heading: "<i>h</i>", tone: "info", items: [{ text: "<script>1</script>" }] }],
    });
    expect(m.html).not.toMatch(/<b>x<\/b>|<i>h<\/i>|<script>/);
  });
});

describe("reply-to", () => {
  it("sends replies to the event's support email", async () => {
    const { store } = fakeStore([entry("a")]);
    const send = vi.fn(async () => ({ ok: true, providerMessageId: null }) as SendResult);
    await processOutbox(store, { name: "spy", verify: async () => ({ ok: true, detail: "" }), send });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "divisione@d229.org" }));
  });

  it("is passed to Brevo and Resend in their own field names", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ id: "1", messageId: "1" }), { status: 200 });
    });
    const msg = { to: "a@x.org", subject: "s", html: "h", text: "t", replyTo: "chair@x.org" };
    await createEmailProvider({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "k", EMAIL_FROM: "f@x.org" }).send(msg);
    await createEmailProvider({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "k", EMAIL_FROM: "f@x.org" }).send(msg);
    fetchSpy.mockRestore();
    expect(bodies[0].replyTo).toEqual({ email: "chair@x.org" });
    expect(bodies[1].reply_to).toBe("chair@x.org");
  });
});
