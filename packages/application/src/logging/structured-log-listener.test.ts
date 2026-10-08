import {
  DiagnosticAttributeNames,
  DiagnosticEventNames,
  StructuredLogLevels,
  type DiagnosticEvent,
  type StructuredLogRecord,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { createStructuredLogListener } from "./structured-log-listener.js";

describe("createStructuredLogListener", () => {
  it.each([
    [DiagnosticEventNames.ApplicationStarting, StructuredLogLevels.Info, "Application starting."],
    [DiagnosticEventNames.ApplicationStarted, StructuredLogLevels.Info, "Application started."],
    [DiagnosticEventNames.ApplicationStartFailed, StructuredLogLevels.Error, "Application start failed."],
    [DiagnosticEventNames.ApplicationStopping, StructuredLogLevels.Info, "Application stopping."],
    [DiagnosticEventNames.ApplicationStopped, StructuredLogLevels.Info, "Application stopped."],
    [DiagnosticEventNames.ApplicationStopFailed, StructuredLogLevels.Error, "Application stop failed."],
    [DiagnosticEventNames.ExecutionStarted, StructuredLogLevels.Info, "Execution started."],
    [DiagnosticEventNames.ExecutionCompleted, StructuredLogLevels.Info, "Execution completed."],
    [DiagnosticEventNames.ExecutionFailed, StructuredLogLevels.Error, "Execution failed."],
  ] as const)(
    "maps %s to %s",
    (name, level, message) => {
      const records: StructuredLogRecord[] = [];
      const listener = createStructuredLogListener({
        sink: {
          write(record) {
            records.push(record);
          },
        },
      });

      listener.onEvent({
        name,
        timestamp: new Date("2026-10-08T12:00:00.000Z"),
        attributes: {},
      });

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        level,
        event: name,
        message,
      });
    },
  );

  it("preserves Forge correlation and framework attributes", () => {
    const records: StructuredLogRecord[] = [];
    const listener = createStructuredLogListener({
      sink: {
        write(record) {
          records.push(record);
        },
      },
    });

    listener.onEvent(executionEvent());

    expect(records[0]).toMatchObject({
      executionId: "execution-1",
      attributes: {
        [DiagnosticAttributeNames.ToolName]: "echo",
        [DiagnosticAttributeNames.DurationMs]: 12,
      },
    });
  });

  it("excludes arbitrary execution attributes by default", () => {
    const records: StructuredLogRecord[] = [];
    const listener = createStructuredLogListener({
      sink: {
        write(record) {
          records.push(record);
        },
      },
    });

    listener.onEvent(executionEvent());

    expect(records[0]?.attributes).not.toHaveProperty("secret");
    expect(records[0]?.attributes).not.toHaveProperty("mcp.requestId");
  });

  it("includes only explicitly selected execution attributes", () => {
    const records: StructuredLogRecord[] = [];
    const listener = createStructuredLogListener({
      sink: {
        write(record) {
          records.push(record);
        },
      },
      executionAttributeNames: ["mcp.requestId", "missing", "mcp.requestId"],
    });

    listener.onEvent(executionEvent());

    expect(records[0]?.attributes).toEqual({
      "mcp.requestId": "request-1",
      [DiagnosticAttributeNames.ToolName]: "echo",
      [DiagnosticAttributeNames.DurationMs]: 12,
    });
    expect(records[0]?.attributes).not.toHaveProperty("secret");
  });

  it("keeps framework attributes authoritative on key collisions", () => {
    const records: StructuredLogRecord[] = [];
    const listener = createStructuredLogListener({
      sink: {
        write(record) {
          records.push(record);
        },
      },
      executionAttributeNames: [DiagnosticAttributeNames.ToolName],
    });

    const event = executionEvent({
      [DiagnosticAttributeNames.ToolName]: "caller-value",
    });

    listener.onEvent(event);

    expect(records[0]?.attributes[DiagnosticAttributeNames.ToolName]).toBe(
      "echo",
    );
  });

  it("emits shallow immutable record snapshots", () => {
    const records: StructuredLogRecord[] = [];
    const timestamp = new Date("2026-10-08T12:00:00.000Z");
    const listener = createStructuredLogListener({
      sink: {
        write(record) {
          records.push(record);
        },
      },
    });

    listener.onEvent({
      name: DiagnosticEventNames.ApplicationStarted,
      timestamp,
      attributes: { state: "started" },
    });

    const record = records[0];

    expect(record).toBeDefined();
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record?.attributes)).toBe(true);
    expect(record?.timestamp).not.toBe(timestamp);
    expect(record?.timestamp.getTime()).toBe(timestamp.getTime());
  });
});

function executionEvent(
  executionAttributes: Readonly<Record<string, unknown>> = {
    "mcp.requestId": "request-1",
    secret: "do-not-log",
  },
): DiagnosticEvent {
  return {
    name: DiagnosticEventNames.ExecutionCompleted,
    timestamp: new Date("2026-10-08T12:00:00.000Z"),
    attributes: {
      [DiagnosticAttributeNames.ToolName]: "echo",
      [DiagnosticAttributeNames.DurationMs]: 12,
    },
    execution: {
      id: "execution-1",
      startedAt: new Date("2026-10-08T11:59:59.988Z"),
      attributes: executionAttributes,
    },
  };
}
