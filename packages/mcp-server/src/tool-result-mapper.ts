import type { ToolResult } from "@forgemcp/core";
import type { CallToolResult } from "@modelcontextprotocol/server";

/**
 * Converts a ForgeMCP tool result into an MCP tool-call result.
 */
export function toMcpToolResult(result: ToolResult): CallToolResult {
  if (result.value === undefined) {
    return { content: [] };
  }

  const text =
    typeof result.value === "string"
      ? result.value
      : serializeToolResult(result.value);

  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function serializeToolResult(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);

    return serialized ?? String(value);
  } catch {
    return String(value);
  }
}
