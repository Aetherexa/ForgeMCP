import type {
  Application,
  Dictionary,
  ToolMetadata,
  ToolResult,
} from "@forgemcp/core";
import { LifecycleState } from "@forgemcp/core";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

class TestApplication implements Application {
  public state: LifecycleState = LifecycleState.Created;
  public starts = 0;
  public stops = 0;
  public failDiscovery = false;

  public async start(): Promise<void> {
    this.starts += 1;
    this.state = LifecycleState.Started;
  }

  public async stop(): Promise<void> {
    this.stops += 1;
    this.state = LifecycleState.Stopped;
  }

  public listTools(): readonly ToolMetadata[] {
    if (this.failDiscovery) {
      throw new Error("tool discovery failed");
    }

    return [];
  }

  public async execute<TInput = unknown, TResult = unknown>(
    _toolName: string,
    _input: TInput,
    _attributes?: Readonly<Dictionary<unknown>>,
  ): Promise<ToolResult<TResult>> {
    throw new Error("No tools are registered.");
  }
}

describe("createForgeMcpServer lifecycle", () => {
  it("starts the application and stops it when the MCP server closes", async () => {
    const application = new TestApplication();

    const server = await createForgeMcpServer({
      name: "lifecycle-test",
      version: "0.2.0",
      createApplication: () => application,
    });

    expect(application.starts).toBe(1);
    expect(application.state).toBe(LifecycleState.Started);

    const [, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await server.close();

    expect(application.stops).toBe(1);
    expect(application.state).toBe(LifecycleState.Stopped);
  });

  it("stops an application when adapter initialization fails after startup", async () => {
    const application = new TestApplication();
    application.failDiscovery = true;

    await expect(
      createForgeMcpServer({
        name: "failure-test",
        version: "0.2.0",
        createApplication: () => application,
      }),
    ).rejects.toThrow("tool discovery failed");

    expect(application.starts).toBe(1);
    expect(application.stops).toBe(1);
    expect(application.state).toBe(LifecycleState.Stopped);
  });
});
