import assert from "node:assert/strict";

const core = await import("../packages/core/dist/index.mjs");
const application = await import("../packages/application/dist/index.mjs");
const mcpServer = await import("../packages/mcp-server/dist/index.mjs");
const stdio = await import("../packages/mcp-server/dist/stdio.mjs");

assert.equal(typeof core.LifecycleState, "object");
assert.equal(typeof core.createServiceToken, "function");
assert.equal(typeof core.ServiceNotFoundError, "function");
assert.equal(typeof core.DiagnosticEventNames, "object");
assert.equal(typeof core.DiagnosticAttributeNames, "object");
assert.equal(typeof core.StructuredLogLevels, "object");

assert.equal(typeof application.ForgeApplicationBuilder, "function");
assert.equal(typeof application.ForgeConfiguration, "function");
assert.equal(typeof application.EnvironmentConfigurationSource, "function");
assert.equal(typeof application.ServiceDisposalError, "function");
assert.equal(typeof application.MissingModuleDependencyError, "function");
assert.equal(typeof application.CircularModuleDependencyError, "function");
assert.equal(typeof application.createStructuredLogListener, "function");
assert.equal(typeof application.createExecutionTelemetryListener, "function");
assert.equal(typeof application.createApplicationHealth, "function");
assert.equal(typeof application.createStderrJsonLogSink, "function");

assert.equal(typeof mcpServer.createForgeMcpServer, "function");
assert.equal(typeof stdio.serveForgeMcpStdio, "function");

const healthApp = application.ForgeApplicationBuilder.create().build();
const health = application.createApplicationHealth(healthApp);
assert.equal(health.liveness().status, "down");
await healthApp.start();
assert.equal((await health.readiness()).status, "up");
await healthApp.stop();
assert.equal(health.liveness().status, "down");

const otel = await import("../packages/telemetry-otel/dist/index.mjs");
if (typeof otel.createOpenTelemetrySink !== "function")
  throw new Error("Missing OpenTelemetry export");
const diagnostics = application.createRuntimeDiagnostics();
if (diagnostics.snapshot().activeExecutions !== 0)
  throw new Error("Invalid diagnostics export");

console.log("Built package entry points loaded successfully.");
