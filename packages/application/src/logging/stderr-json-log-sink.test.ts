import {
  DiagnosticAttributeNames,
  DiagnosticEventNames,
  StructuredLogLevels,
  type StructuredLogRecord,
} from "@forgemcp/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStderrJsonLogSink } from "./stderr-json-log-sink.js";

describe("createStderrJsonLogSink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes deterministic JSON Lines to stderr and never stdout", () => {
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const sink = createStderrJsonLogSink();
    const record: StructuredLogRecord = {
      timestamp: new Date("2026-10-08T18:00:00.000Z"),
      level: StructuredLogLevels.Info,
      event: DiagnosticEventNames.ExecutionCompleted,
      message: "Execution completed.",
      executionId: "execution-1",
      attributes: {
        [DiagnosticAttributeNames.ToolName]: "echo",
        [DiagnosticAttributeNames.DurationMs]: 5,
      },
    };

    sink.write(record);

    expect(stderrWrite).toHaveBeenCalledTimes(1);
    expect(stderrWrite).toHaveBeenCalledWith(
      '{"timestamp":"2026-10-08T18:00:00.000Z","level":"info","event":"execution.completed","message":"Execution completed.","executionId":"execution-1","attributes":{"tool.name":"echo","duration.ms":5}}\n',
    );
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it("omits executionId when the record is not execution-scoped", () => {
    const stderrWrite = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    const sink = createStderrJsonLogSink();

    sink.write({
      timestamp: new Date("2026-10-08T18:00:00.000Z"),
      level: StructuredLogLevels.Info,
      event: DiagnosticEventNames.ApplicationStarted,
      message: "Application started.",
      attributes: {},
    });

    const line = stderrWrite.mock.calls[0]?.[0];

    expect(typeof line).toBe("string");
    expect(JSON.parse(line as string)).toEqual({
      timestamp: "2026-10-08T18:00:00.000Z",
      level: "info",
      event: "application.started",
      message: "Application started.",
      attributes: {},
    });
  });
});
