import {describe,it,expect} from "vitest";
import {cardStatus,editableDossier,missingProfile,profileSchema} from "./membership-rules";
import {identityCrop} from "./photo-processing";
import {isMatricule,loginToEmail} from "./member-ids";
describe("Membership policy",()=>{
 it("preserves vipbgg-656 and accepts sequential identifiers beyond 999",()=>{expect(loginToEmail("vipbgg-656")).toBe("vipbgg-656@membres.bokguisguis.sn");expect(isMatricule("VIPBGG-1000")).toBe(true);});
 it("locks submitted profiles until correction is requested",()=>{expect(editableDossier("soumis")).toBe(false);expect(editableDossier("verification")).toBe(false);expect(editableDossier("valide")).toBe(false);expect(editableDossier("correction")).toBe(true);});
 it("requires confirmation and certification before submission",()=>{const p=profileSchema.parse({});expect(missingProfile(p)).toContain("Photo confirmée");expect(missingProfile(p)).toContain("Certification");});
 it("expires only after the chosen end date",()=>{expect(cardStatus("active","actif","actif","2026-01-01","2026-12-31","2026-12-31")).toBe("valide");expect(cardStatus("active","actif","actif","2026-01-01","2026-12-31","2027-01-01")).toBe("expiree");});
 it("immediately reflects member suspension and card cancellation",()=>{expect(cardStatus("active","suspendu","actif","2026-01-01","2026-12-31","2026-06-01")).toBe("suspendue");expect(cardStatus("cancelled","actif","actif","2026-01-01","2026-12-31","2026-06-01")).toBe("invalide");});
 it("uses 35 by 45 geometry and keeps the crop inside the source",()=>{const c=identityCrop({originX:450,originY:100,width:100,height:140},600,800);expect(c.width/c.height).toBeCloseTo(35/45);expect(c.x+c.width).toBeLessThanOrEqual(600);expect(c.y+c.height).toBeLessThanOrEqual(800);});
});