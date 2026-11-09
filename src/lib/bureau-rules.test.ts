import { describe, expect, it } from "vitest";
import { bureauContactAllowed } from "./bureau-rules";

describe("bureau contacts", () => {
  it("shows contacts when authorized and a phone is provided", () => {
    expect(bureauContactAllowed("+221 77 206 09 98", true)).toBe(true);
  });
  it("hides contacts when authorization is withdrawn", () => {
    expect(bureauContactAllowed("+221 77 206 09 98", false)).toBe(false);
  });
  it("does not offer contact without a phone", () => {
    expect(bureauContactAllowed(null, true)).toBe(false);
  });
});