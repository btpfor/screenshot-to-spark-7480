import { describe, expect, it } from "vitest";
import { canEditPresident, canReadPresident } from "./president-rules";

describe("president publication permissions", () => {
  it("allows only institutional editors to change the message", () => {
    for (const role of ["super_admin", "president", "secretaire"]) expect(canEditPresident([role])).toBe(true);
    for (const role of ["chauffeur", "tresorier", "resp_parc", "resp_chauffeurs", "resp_partenariats"]) expect(canEditPresident([role])).toBe(false);
    expect(canEditPresident([])).toBe(false);
  });
  it("hides unpublished messages from visitors but keeps editor access", () => {
    expect(canReadPresident(false, [])).toBe(false);
    expect(canReadPresident(false, ["chauffeur"])).toBe(false);
    expect(canReadPresident(false, ["super_admin"])).toBe(true);
    expect(canReadPresident(true, [])).toBe(true);
  });
});