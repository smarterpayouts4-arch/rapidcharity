import { describe, expect, it } from "vitest";
import { duplicateKeyId } from "../../functions/src/duplicateKey";

const SECRET = "test-secret-at-least-16";

describe("duplicateKeyId", () => {
  it("does not contain raw cnic", () => {
    const id = duplicateKeyId("spring-2027", "3520212345671", SECRET);
    expect(id).not.toContain("35202");
    expect(id.length).toBe(40);
  });
  it("is stable for same inputs", () => {
    const a = duplicateKeyId("spring-2027", "3520212345671", SECRET);
    const b = duplicateKeyId("spring-2027", "3520212345671", SECRET);
    expect(a).toBe(b);
  });
  it("refuses to run without a real secret", () => {
    expect(() => duplicateKeyId("spring-2027", "3520212345671", "")).toThrow();
  });
});
