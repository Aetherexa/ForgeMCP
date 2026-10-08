import { describe, expect, it } from "vitest";

import { StructuredLogLevels } from "./structured-log-level.js";

describe("StructuredLogLevels", () => {
  it("exposes the stable severity vocabulary", () => {
    expect(StructuredLogLevels).toEqual({
      Debug: "debug",
      Info: "info",
      Warn: "warn",
      Error: "error",
    });
  });

  it("is immutable", () => {
    expect(Object.isFrozen(StructuredLogLevels)).toBe(true);
  });
});
