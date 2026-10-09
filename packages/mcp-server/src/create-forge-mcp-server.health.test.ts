import {
  createApplicationHealth,
  ForgeApplicationBuilder,
} from "@forgemcp/application";
import {
  createServiceToken,
  LifecycleState,
  type ApplicationHealth,
  type HealthReport,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { Client } from "@modelcontextprotocol/client";
import {
  InMemoryTransport,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";

import { createForgeMcpServer } from "./create-forge-mcp-server.js";

const resourceToken = createServiceToken<{ [Symbol.dispose](): void }>(
  "health-test-resource",
);

describe("official MCP application health", () => {
  it("exposes health explicitly and preserves tool execution and graceful drain", async () => {
    let health!: ApplicationHealth;
    let dependency: "up" | "down" | "failed" | "hung" = "up";
    let disposed = 0;
    let markEntered!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    class HealthModule implements Module {
      configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "operator-health" },
          async execute() {
            return { value: await health.readiness() };
          },
        });
        builder.tool({
          metadata: { name: "echo" },
          execute() {
            return { value: "ok" };
          },
        });
        builder.tool({
          metadata: { name: "drain" },
          async execute() {
            markEntered();
            await barrier;
            return { value: "drained" };
          },
        });
      }
    }
    const app = ForgeApplicationBuilder.create()
      .provideFactory(resourceToken, () => ({
        [Symbol.dispose]() {
          disposed += 1;
        },
      }))
      .use(HealthModule)
      .build();
    health = createApplicationHealth(app, {
      timeoutMs: 20,
      checks: [
        {
          name: "backend",
          check() {
            if (dependency === "failed")
              throw new Error("private-backend-secret");
            if (dependency === "hung") return new Promise<"up">(() => {});
            return dependency;
          },
        },
      ],
    });
    expect(health.liveness().status).toBe("down");
    const server = await createForgeMcpServer({
      name: "health-server",
      version: "0.3.0",
      createApplication: () => app,
    });
    const client = new Client({ name: "health-client", version: "0.3.0" });
    try {
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "drain",
        "echo",
        "operator-health",
      ]);
      expect(
        readReport(await client.callTool({ name: "operator-health" })).status,
      ).toBe("up");
      for (const state of ["down", "failed", "hung"] as const) {
        dependency = state;
        const result = await client.callTool({ name: "operator-health" });
        expect(result.isError).not.toBe(true);
        const report = readReport(result);
        expect(report.status).toBe("down");
        expect(report.checks[0]?.reason).toBe(
          state === "down"
            ? undefined
            : state === "failed"
              ? "failed"
              : "timeout",
        );
        expect(JSON.stringify(report)).not.toContain("private-backend-secret");
        expect(health.liveness().status).toBe("up");
        expect(app.state).toBe(LifecycleState.Started);
      }
      expect((await client.callTool({ name: "echo" })).content).toEqual([
        { type: "text", text: "ok" },
      ]);
      const active = client.callTool({ name: "drain" });
      await entered;
      const stopping = app.stop();
      expect(app.state).toBe(LifecycleState.Stopping);
      expect((await health.readiness()).status).toBe("down");
      expect(health.liveness().status).toBe("up");
      expect(disposed).toBe(0);
      release();
      expect((await active).content).toEqual([
        { type: "text", text: "drained" },
      ]);
      await stopping;
      expect(disposed).toBe(1);
      expect(app.state).toBe(LifecycleState.Stopped);
      expect(health.liveness().status).toBe("down");
      expect((await health.readiness()).checks).toEqual([]);
      await server.close();
      await server.close();
      expect(disposed).toBe(1);
    } finally {
      release();
      await client.close();
      await server.close();
    }
  });
});

function readReport(result: CallToolResult): HealthReport {
  const text = result.content.find((block) => block.type === "text");
  if (text?.type !== "text") throw new Error("Missing health response.");
  return JSON.parse(text.text) as HealthReport;
}
