import { describe, expect, it } from "vitest";
import { genTempPassword, loginToEmail, matriculeToEmail } from "./member-ids";

describe("member login ids", () => {
  it("maps a matricule to one internal email, case-insensitive", () => {
    expect(matriculeToEmail("BGG-2026-0001")).toBe("bgg-2026-0001@membres.bokguisguis.sn");
    expect(loginToEmail(" bgg-2026-0001 ")).toBe(matriculeToEmail("BGG-2026-0001"));
  });
  it("keeps staff emails as-is", () => {
    expect(loginToEmail("admin@gie.sn")).toBe("admin@gie.sn");
  });
  it("generates a strong temporary password", () => {
    expect(genTempPassword().length).toBeGreaterThanOrEqual(12);
  });
});
