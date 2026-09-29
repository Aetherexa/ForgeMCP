import {
  serveStdio,
  type StdioServerHandle,
} from "@modelcontextprotocol/server/stdio";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";
import type { ForgeMcpServerOptions } from "./options.js";

/**
 * Serves a ForgeMCP application over MCP stdio.
 *
 * The official SDK owns protocol-era negotiation and the stdio transport.
 */
export function serveForgeMcpStdio(
  options: ForgeMcpServerOptions,
): StdioServerHandle {
  return serveStdio(() => createForgeMcpServer(options));
}
