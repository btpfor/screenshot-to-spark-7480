import { describe, expect, it } from "vitest";
import { countAtProgress, missionStats } from "./mission-stats";

describe("mission counters", () => {
  it("keeps the chauffeur count at 300 with a plus prefix", () => {
    expect(missionStats[0]).toMatchObject({ value: 300, prefix: "+" });
  });
  it("counts progressively and finishes at the actual value", () => {
    expect(countAtProgress(300, 0)).toBe(0);
    expect(countAtProgress(300, 0.5)).toBe(263);
    expect(countAtProgress(300, 1)).toBe(300);
  });
});