import type { Dictionary } from "@forgemcp/core";
import type { ServerContext } from "@modelcontextprotocol/server";

/**
 * Converts MCP request context into protocol-neutral ForgeMCP execution
 * attributes.
 */
export function createMcpExecutionAttributes(
  context: ServerContext,
): Readonly<Dictionary<unknown>> {
  const attributes: Dictionary<unknown> = {
    "mcp.requestId": context.mcpReq.id,
    "mcp.transport": context.http === undefined ? "stdio" : "http",
  };

  if (context.sessionId !== undefined) {
    attributes["mcp.sessionId"] = context.sessionId;
  }

  if (context.mcpReq._meta !== undefined) {
    attributes["mcp.meta"] = context.mcpReq._meta;
  }

  return Object.freeze(attributes);
}
