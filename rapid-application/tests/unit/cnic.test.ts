import { describe, expect, it } from "vitest";
import { formatCnicDisplay, isValidCnic, normalizeCnicDigits } from "@/lib/validation/cnic";

describe("cnic", () => {
  it("normalizes digits", () => {
    expect(normalizeCnicDigits("35202-1234567-1")).toBe("3520212345671");
  });
  it("formats display", () => {
    expect(formatCnicDisplay("3520212345671")).toBe("35202-1234567-1");
  });
  it("validates length", () => {
    expect(isValidCnic("3520212345671")).toBe(true);
    expect(isValidCnic("123")).toBe(false);
  });
});
