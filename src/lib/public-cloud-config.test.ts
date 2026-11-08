import { describe, expect, it } from "vitest";
import { publicCloudConfig } from "./public-cloud-config";

describe("public Cloud deployment configuration", () => {
  it("uses the server backend when both environments are available", () => {
    expect(publicCloudConfig({ url: "https://server.example", key: "server-public" }, { url: "https://browser.example", key: "browser-public" }))
      .toEqual({ url: "https://server.example", key: "server-public" });
  });
  it("supports an external deployment with only bundled public configuration", () => {
    expect(publicCloudConfig({}, { url: "https://browser.example", key: "browser-public" }))
      .toEqual({ url: "https://browser.example", key: "browser-public" });
  });
  it("never mixes an incomplete server pair with browser credentials", () => {
    expect(publicCloudConfig({ url: "https://server.example" }, { url: "https://browser.example", key: "browser-public" }))
      .toEqual({ url: "https://browser.example", key: "browser-public" });
    expect(publicCloudConfig({ url: "https://server.example" }, { key: "browser-public" })).toBeNull();
  });
});