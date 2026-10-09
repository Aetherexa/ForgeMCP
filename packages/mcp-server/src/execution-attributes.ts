import type { Dictionary } from "@forgemcp/core";
import type { ServerContext } from "@modelcontextprotocol/server";

/**
 * Converts MCP request context into protocol-neutral ForgeMCP execution
 * attributes.
 */
export function createMcpExecutionAttributes(
  context: ServerContext,
  captureTraceContext = false,
): Readonly<Dictionary<unknown>> {
  const attributes: Dictionary<unknown> = {
    "mcp.requestId": context.mcpReq.id,
  };

  if (context.sessionId !== undefined) {
    attributes["mcp.sessionId"] = context.sessionId;
  }

  if (context.mcpReq._meta !== undefined) {
    attributes["mcp.meta"] = context.mcpReq._meta;
  }

  if (captureTraceContext) {
    for (const name of ["traceparent", "tracestate"] as const) {
      const value = context.mcpReq._meta?.[name];
      if (typeof value === "string") attributes[name] = value;
    }
  }
  return Object.freeze(attributes);
}
