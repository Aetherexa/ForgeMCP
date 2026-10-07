import type { Application, ToolMetadata } from "@forgemcp/core";
import {
  McpServer,
  type ServerContext,
  type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";

import { createMcpExecutionAttributes } from "./execution-attributes.js";
import type { ForgeMcpServerOptions } from "./options.js";
import { toMcpToolResult } from "./tool-result-mapper.js";

/**
 * Creates and starts a ForgeMCP application, then exposes its tools through
 * the official MCP TypeScript server SDK.
 */
export async function createForgeMcpServer(
  options: ForgeMcpServerOptions,
): Promise<McpServer> {
  const application = await options.createApplication();

  await application.start();

  try {
    const server = new McpServer({
      name: options.name,
      version: options.version,
      ...(options.description === undefined
        ? {}
        : { description: options.description }),
    });

    for (const tool of application.listTools()) {
      registerTool(server, application, tool);
    }

    installApplicationShutdown(server, application);

    return server;
  } catch (error) {
    await application.stop();
    throw error;
  }
}

function registerTool(
  server: McpServer,
  application: Application,
  tool: ToolMetadata,
): void {
  const config = {
    ...(tool.description === undefined
      ? {}
      : { description: tool.description }),
  };

  if (tool.inputSchema === undefined) {
    server.registerTool(tool.name, config, async (context: ServerContext) => {
      const result = await application.execute(
        tool.name,
        undefined,
        createMcpExecutionAttributes(context),
      );

      return toMcpToolResult(result);
    });

    return;
  }

  server.registerTool(
    tool.name,
    {
      ...config,
      inputSchema: tool.inputSchema as StandardSchemaWithJSON,
    },
    async (input, context) => {
      const result = await application.execute(
        tool.name,
        input,
        createMcpExecutionAttributes(context),
      );

      return toMcpToolResult(result);
    },
  );
}

function installApplicationShutdown(
  server: McpServer,
  application: Application,
): void {
  const originalClose = server.close.bind(server);
  let stopPromise: Promise<void> | undefined;
  let closePromise: Promise<void> | undefined;

  const stopApplication = (): Promise<void> => {
    stopPromise ??= application.stop();
    return stopPromise;
  };

  server.server.onclose = () => {
    void stopApplication();
  };

  server.close = () => {
    closePromise ??= (async () => {
      await originalClose();
      await stopApplication();
    })();

    return closePromise;
  };
}
