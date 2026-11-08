import { describe, expect, it } from "vitest";
import { appWorkerScript, installationPlatform, refuseAppWorker } from "./pwa-policy";

describe("Protection du service worker", () => {
  it("refuse le développement et les cadres", () => {
    expect(refuseAppWorker(false, "localhost", false, "")).toBe(true);
    expect(refuseAppWorker(true, "gie.example.com", true, "")).toBe(true);
  });
  it.each(["id-preview--abc.lovable.app", "preview-2--abc.gpt-eng.com", "preview--abc.gptengineer.run", "project--abc-dev.lovable.app", "test.lovableproject.com", "lovableproject-dev.com", "test.beta.lovable.dev"])("refuse l’aperçu %s", (host) => {
    expect(refuseAppWorker(true, host, false, "")).toBe(true);
  });
  it("autorise la publication et les domaines personnalisés", () => {
    expect(refuseAppWorker(true, "screenshot-to-spark-7480.lovable.app", false, "")).toBe(false);
    expect(refuseAppWorker(true, "preview-v2--shop.example.com", false, "")).toBe(false);
  });
  it("respecte la désactivation explicite", () => expect(refuseAppWorker(true, "gie.example.com", false, "?sw=off")).toBe(true));
  it("ne désinscrit jamais un worker de notifications", () => {
    expect(appWorkerScript("https://gie.example.com/sw.js", "https://gie.example.com")).toBe(true);
    expect(appWorkerScript("https://gie.example.com/firebase-messaging-sw.js", "https://gie.example.com")).toBe(false);
  });
  it("détecte iPhone, iPad desktop et Android", () => {
    expect(installationPlatform("iPhone Safari", 1)).toBe("ios");
    expect(installationPlatform("Macintosh Safari", 5)).toBe("ios");
    expect(installationPlatform("Android Chrome", 5)).toBe("android");
  });
});