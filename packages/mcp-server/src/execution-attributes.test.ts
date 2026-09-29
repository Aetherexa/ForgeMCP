import type { ServerContext } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { createMcpExecutionAttributes } from "./execution-attributes.js";

function createContext(
  value: Partial<Pick<ServerContext, "sessionId">> & {
    readonly mcpReq: {
      readonly id: string;
      readonly _meta?: Record<string, unknown>;
    };
  },
): ServerContext {
  return value as unknown as ServerContext;
}

describe("createMcpExecutionAttributes", () => {
  it("always maps the MCP request id", () => {
    const attributes = createMcpExecutionAttributes(
      createContext({
        mcpReq: {
          id: "request-1",
        },
      }),
    );

    expect(attributes).toEqual({
      "mcp.requestId": "request-1",
    });
    expect(Object.isFrozen(attributes)).toBe(true);
  });

  it("maps optional session and request metadata", () => {
    const meta = {
      traceId: "trace-1",
    };

    const attributes = createMcpExecutionAttributes(
      createContext({
        sessionId: "session-1",
        mcpReq: {
          id: "request-2",
          _meta: meta,
        },
      }),
    );

    expect(attributes).toEqual({
      "mcp.requestId": "request-2",
      "mcp.sessionId": "session-1",
      "mcp.meta": meta,
    });
  });
});
