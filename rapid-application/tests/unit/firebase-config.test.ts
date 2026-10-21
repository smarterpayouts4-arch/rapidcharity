import { describe, expect, it } from "vitest";
import { firebaseConfig, useEmulators } from "@/lib/firebase/config";

describe("firebase config", () => {
  it("has project id", () => {
    expect(firebaseConfig.projectId.length).toBeGreaterThan(0);
  });
  it("uses emulators in test", () => {
    expect(useEmulators).toBe(true);
  });
});
