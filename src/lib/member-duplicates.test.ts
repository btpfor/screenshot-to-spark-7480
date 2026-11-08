import { describe, expect, it, vi } from "vitest";
import { conflictFromDatabaseError, findMemberConflict, normalizeCni } from "./member-duplicates";
import { memberIdentifierFromCni } from "./member-ids";

describe("member duplicate protection", () => {
  const existing = { cni_number: "12345abc", matricule: "vipbgg-abc" };
  const lookup = async (field: "cni_number" | "matricule", value: string) => existing[field] === value;

  it("rejects the same CNI, ignoring case and surrounding spaces, before checking the identifier", async () => {
    const exists = vi.fn(lookup);
    expect(await findMemberConflict(" 12345AbC ", "vipbgg-abc", exists)).toBe("cni");
    expect(exists.mock.calls).toEqual([["cni_number", "12345abc"]]);
    expect(normalizeCni(" 12345AbC ")).toBe("12345abc");
  });

  it("rejects a different CNI generating an already assigned vipbgg identifier", async () => {
    const cni = "98765ABC";
    expect(await findMemberConflict(cni, memberIdentifierFromCni(cni), lookup)).toBe("identifier");
  });

  it("allows a new CNI with an unused generated identifier", async () => {
    const cni = "1234567890123";
    expect(await findMemberConflict(cni, memberIdentifierFromCni(cni), lookup)).toBeNull();
  });

  it("classifies concurrent CNI conflicts from the database uniqueness safeguard", () => {
    expect(conflictFromDatabaseError({ code: "23505", message: 'duplicate key violates unique constraint "drivers_cni_unique"' })).toBe("cni");
  });

  it("classifies identifier conflicts without hiding unrelated errors", () => {
    expect(conflictFromDatabaseError({ code: "23505", message: 'duplicate key violates unique constraint "drivers_matricule_ci"' })).toBe("identifier");
    expect(conflictFromDatabaseError({ code: "42501", message: "matricule access denied" })).toBeNull();
  });
});