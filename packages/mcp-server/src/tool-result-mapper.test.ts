import { describe, expect, it } from "vitest";

import { toMcpToolResult } from "./tool-result-mapper.js";

describe("toMcpToolResult", () => {
  it("maps string values directly to text content", () => {
    expect(toMcpToolResult({ value: "hello" })).toEqual({
      content: [{ type: "text", text: "hello" }],
    });
  });

  it("serializes object values as JSON text", () => {
    expect(
      toMcpToolResult({
        value: {
          ok: true,
        },
      }),
    ).toEqual({
      content: [{ type: "text", text: '{"ok":true}' }],
    });
  });

  it("returns empty content for undefined values", () => {
    expect(toMcpToolResult({ value: undefined })).toEqual({
      content: [],
    });
  });
});
