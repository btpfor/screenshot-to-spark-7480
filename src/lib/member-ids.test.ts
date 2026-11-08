import { describe, expect, it } from "vitest";
import { genTempPassword, isMatricule, loginToEmail, matriculeToEmail, memberIdentifierFromCni } from "./member-ids";

describe("member login ids", () => {
  it("uses vipbgg- and the last three identity-card characters", () => {
    expect(memberIdentifierFromCni("1234567890123")).toBe("vipbgg-123");
    expect(memberIdentifierFromCni(" 12345AbC ")).toBe("vipbgg-abc");
  });
  it("rejects missing, short or malformed identity-card numbers", () => {
    for (const cni of ["", "12", "123@", "123 456"]) expect(() => memberIdentifierFromCni(cni)).toThrow();
  });
  it("accepts new identifiers case-insensitively and preserves existing logins", () => {
    expect(isMatricule(" VIPBGG-123 ")).toBe(true);
    expect(isMatricule("BGG-2026-0001")).toBe(true);
    expect(isMatricule("vipbgg-12")).toBe(false);
    expect(isMatricule("vipbgg-1234")).toBe(false);
    expect(loginToEmail(" VIPBGG-123 ")).toBe("vipbgg-123@membres.bokguisguis.sn");
  });
  it("maps a matricule to one internal email, case-insensitive", () => {
    expect(matriculeToEmail("BGG-2026-0001")).toBe("bgg-2026-0001@membres.bokguisguis.sn");
    expect(loginToEmail(" bgg-2026-0001 ")).toBe(matriculeToEmail("BGG-2026-0001"));
  });
  it("keeps staff emails as-is", () => {
    expect(loginToEmail("admin@gie.sn")).toBe("admin@gie.sn");
  });
  it("accepts the requested administrator identifier", () => {
    expect(loginToEmail("admin@vipbgg.com")).toBe("admin@vipbgg.com");
  });
  it("generates a strong temporary password", () => {
    expect(genTempPassword().length).toBeGreaterThanOrEqual(12);
  });
});
