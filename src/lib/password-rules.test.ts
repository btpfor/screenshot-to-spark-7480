import { describe, expect, it } from "vitest";
import { passwordChangeError } from "./password-rules";

describe("password replacement", () => {
  it("requires a different password", () => {
    expect(passwordChangeError("Temporary123!", "Temporary123!", "Temporary123!")).not.toBeNull();
    expect(passwordChangeError("Temporary123!", "Personal456!", "Personal456!")).toBeNull();
  });
  it("requires eight characters", () => {
    expect(passwordChangeError("Temporary123!", "short", "short")).not.toBeNull();
  });
  it("requires matching confirmation", () => {
    expect(passwordChangeError("Temporary123!", "Personal456!", "Other456!")).not.toBeNull();
  });
});