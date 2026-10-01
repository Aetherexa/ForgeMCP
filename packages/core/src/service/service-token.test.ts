import { describe, expect, it } from "vitest";

import { ServiceNotFoundError } from "./service-error.js";
import { createServiceToken } from "./service-token.js";

describe("createServiceToken", () => {
  it("creates a frozen token with a normalized description", () => {
    const token = createServiceToken<string>(" Api Client ");

    expect(token.description).toBe("Api Client");
    expect(typeof token.id).toBe("symbol");
    expect(Object.isFrozen(token)).toBe(true);
  });

  it("creates unique token identities even when descriptions match", () => {
    const first = createServiceToken<string>("apiClient");
    const second = createServiceToken<string>("apiClient");

    expect(first).not.toBe(second);
    expect(first.id).not.toBe(second.id);
  });

  it("rejects an empty token description", () => {
    expect(() => createServiceToken("   ")).toThrow(
      "Service token description must not be empty.",
    );
  });
});

describe("ServiceNotFoundError", () => {
  it("includes the service description in a stable diagnostic", () => {
    const token = createServiceToken<string>("apiClient");
    const error = new ServiceNotFoundError(token);

    expect(error.name).toBe("ServiceNotFoundError");
    expect(error.tokenDescription).toBe("apiClient");
    expect(error.message).toBe(
      "Service 'apiClient' is required but was not registered.",
    );
  });
});
