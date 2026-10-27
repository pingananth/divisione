import { describe, it, expect } from "vitest";
import { prefillFromQuery } from "./prefill";
import { availableTickets } from "./pricing";
import type { PriceTier } from "./types";

const tiers: PriceTier[] = [
  { id: "student", ticket: "student", label: "Student", amountPaise: 17500, endsAt: null },
  { id: "toastmaster", ticket: "toastmaster", label: "Toastmaster", amountPaise: 34900, endsAt: null, attendeeType: "toastmaster" },
  { id: "guest", ticket: "guest", label: "Guest", amountPaise: 47900, endsAt: null, attendeeType: "guest" },
  { id: "guest-offer", ticket: "guest", label: "Guest (limited offer)", amountPaise: 34900, endsAt: null, attendeeType: "guest", offer: true },
];
const onSale = (offer: boolean) => availableTickets(tiers, new Date(), offer);

describe("prefillFromQuery", () => {
  it("picks whichever guest price is on sale, so a printed QR keeps working", () => {
    expect(prefillFromQuery(onSale(false), { type: "guest" })).toEqual({ ticket: "guest" });
    expect(prefillFromQuery(onSale(true), { type: "guest" })).toEqual({ ticket: "guest-offer" });
  });

  it("picks other ticket kinds, ignoring case", () => {
    expect(prefillFromQuery(onSale(false), { type: "Toastmaster" })).toEqual({ ticket: "toastmaster" });
  });

  it("ignores a ticket kind that is not on sale", () => {
    expect(prefillFromQuery(onSale(false), { type: "vip" })).toEqual({});
  });

  it("pre-fills who invited them", () => {
    expect(prefillFromQuery(onSale(false), { type: "guest", ref: " mall-campaign " })).toEqual({
      ticket: "guest",
      invitedBy: "mall-campaign",
    });
  });

  it("skips a blank ref and cuts a long one to the field's limit", () => {
    expect(prefillFromQuery(onSale(false), { ref: "  " })).toEqual({});
    expect(prefillFromQuery(onSale(false), { ref: "x".repeat(300) }).invitedBy).toHaveLength(120);
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(prefillFromQuery(onSale(false), { ref: ["mall-campaign", "other"] })).toEqual({ invitedBy: "mall-campaign" });
  });

  it("returns nothing for a plain link", () => {
    expect(prefillFromQuery(onSale(false), {})).toEqual({});
  });
});
