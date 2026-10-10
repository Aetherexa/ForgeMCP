import assert from "node:assert/strict";
import { LifecycleState } from "@forgemcp/core";
import {
  ForgeApplicationBuilder,
  createApplicationHealth,
  createRuntimeDiagnostics,
  createStructuredLogListener,
  createExecutionTelemetryListener,
  createStderrJsonLogSink,
} from "@forgemcp/application";
import { createForgeMcpServer } from "@forgemcp/mcp-server";
import { serveForgeMcpStdio } from "@forgemcp/mcp-server/stdio";
import { createOpenTelemetrySink } from "@forgemcp/telemetry-otel";

assert.equal(typeof serveForgeMcpStdio, "function");
assert.equal(typeof createStderrJsonLogSink, "function");
assert.equal(typeof createOpenTelemetrySink, "function");
const diagnostics = createRuntimeDiagnostics();
const logs = [],
  spans = [],
  measurements = [];
class Tools {
  configure(builder) {
    builder.tool({
      metadata: { name: "echo" },
      execute() {
        return { value: "ok" };
      },
    });
  }
}
const app = ForgeApplicationBuilder.create()
  .use(Tools)
  .observe(diagnostics.listener)
  .observe(
    createStructuredLogListener({
      sink: { write: (record) => logs.push(record) },
    }),
  )
  .observe(
    createExecutionTelemetryListener({
      sink: {
        writeSpan: (span) => spans.push(span),
        recordMetric: (metric) => measurements.push(metric),
      },
    }),
  )
  .build();
const health = createApplicationHealth(app);
assert.equal(health.liveness().status, "down");
const server = await createForgeMcpServer({
  name: "release-consumer",
  version: "1.0.0",
  createApplication: () => app,
});
try {
  assert.equal((await health.readiness()).status, "up");
  assert.deepEqual(
    await app.execute("echo", undefined, { secret: "private-consumer-data" }),
    { value: "ok" },
  );
  assert.deepEqual(diagnostics.snapshot(), {
    state: LifecycleState.Started,
    activeExecutions: 0,
    completedExecutions: 1,
    failedExecutions: 0,
  });
  assert.equal(spans.length, 1);
  assert.equal(measurements.length, 2);
  assert.ok(logs.length >= 4);
  assert.ok(
    !JSON.stringify({ logs, spans, measurements }).includes(
      "private-consumer-data",
    ),
  );
} finally {
  await server.close();
}
assert.equal(diagnostics.snapshot().state, LifecycleState.Stopped);
assert.equal(health.liveness().status, "down");
