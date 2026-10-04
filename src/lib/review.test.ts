import { describe, it, expect } from "vitest";
import { reviewProblem } from "./review";

const base = { status: "pending" as const, hasUtr: true, decision: "confirmed", note: "" };

describe("reviewProblem", () => {
  it("allows confirming a pending registration that has a UTR, without a note", () => {
    expect(reviewProblem(base)).toBeNull();
  });

  it("allows rejecting a pending registration", () => {
    expect(reviewProblem({ ...base, decision: "rejected" })).toBeNull();
  });

  it("needs a note to confirm someone who never gave a UPI reference", () => {
    expect(reviewProblem({ ...base, hasUtr: false })).toMatch(/add a note/);
    expect(reviewProblem({ ...base, hasUtr: false, note: "   " })).toMatch(/add a note/);
    expect(reviewProblem({ ...base, hasUtr: false, note: "Paid ₹300 cash at desk" })).toBeNull();
  });

  it("does not need a note to reject someone who never paid", () => {
    expect(reviewProblem({ ...base, hasUtr: false, decision: "rejected" })).toBeNull();
  });

  it("refuses to change a registration that is already decided", () => {
    expect(reviewProblem({ ...base, status: "confirmed", decision: "rejected" })).toBe(
      "This registration was already confirmed.",
    );
    expect(reviewProblem({ ...base, status: "rejected" })).toBe("This registration was already rejected.");
  });

  it("rejects an unknown decision", () => {
    expect(reviewProblem({ ...base, decision: "maybe" })).toBe("Choose confirm or reject.");
  });
});
