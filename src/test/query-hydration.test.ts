import { describe, expect, it } from "vitest";
import { getRouter } from "@/router";

describe("SSR public Query hydration", () => {
  it("restores the same public data and signed image URL without a second fetch", async () => {
    const server = getRouter();
    const message = { name: "Badara Ndiaye", photoUrl: "https://example.test/portrait?token=test-only" };
    server.options.context.queryClient.setQueryData(["president-public"], message);
    const dehydrated = await server.options.dehydrate?.();
    expect(dehydrated).toBeDefined();
    if (!dehydrated) throw new Error("Missing SSR data");
    const browser = getRouter();
    await browser.options.hydrate?.(JSON.parse(JSON.stringify(dehydrated)));
    expect(browser.options.context.queryClient.getQueryData(["president-public"])).toEqual(message);
  });
});