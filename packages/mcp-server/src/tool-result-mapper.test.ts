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

  it("serializes primitive non-string values", () => {
    expect(toMcpToolResult({ value: 42 })).toEqual({
      content: [{ type: "text", text: "42" }],
    });
    expect(toMcpToolResult({ value: null })).toEqual({
      content: [{ type: "text", text: "null" }],
    });
  });

  it("falls back to String when JSON serialization returns undefined", () => {
    const value = Symbol("forge");

    expect(toMcpToolResult({ value })).toEqual({
      content: [{ type: "text", text: "Symbol(forge)" }],
    });
  });

  it("falls back to String when JSON serialization throws", () => {
    expect(toMcpToolResult({ value: 1n })).toEqual({
      content: [{ type: "text", text: "1" }],
    });
  });

  it("returns empty content for undefined values", () => {
    expect(toMcpToolResult({ value: undefined })).toEqual({
      content: [],
    });
  });
});
