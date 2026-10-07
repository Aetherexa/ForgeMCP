import assert from "node:assert/strict";

const core = await import("../packages/core/dist/index.mjs");
const application = await import("../packages/application/dist/index.mjs");
const mcpServer = await import("../packages/mcp-server/dist/index.mjs");
const stdio = await import("../packages/mcp-server/dist/stdio.mjs");

assert.equal(typeof core.LifecycleState, "object");
assert.equal(typeof core.createServiceToken, "function");
assert.equal(typeof core.ServiceNotFoundError, "function");

assert.equal(typeof application.ForgeApplicationBuilder, "function");
assert.equal(typeof application.ForgeConfiguration, "function");
assert.equal(typeof application.EnvironmentConfigurationSource, "function");
assert.equal(typeof application.ServiceDisposalError, "function");
assert.equal(typeof application.MissingModuleDependencyError, "function");
assert.equal(typeof application.CircularModuleDependencyError, "function");

assert.equal(typeof mcpServer.createForgeMcpServer, "function");
assert.equal(typeof stdio.serveForgeMcpStdio, "function");

console.log("Built v0.3 package entry points loaded successfully.");
