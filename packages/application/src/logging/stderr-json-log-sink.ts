import type { StructuredLogRecord, StructuredLogSink } from "@forgemcp/core";

/**
 * Creates a structured log sink that writes one JSON object per line to
 * stderr.
 *
 * stdout is intentionally never used because MCP stdio reserves stdout for
 * protocol framing.
 */
export function createStderrJsonLogSink(): StructuredLogSink {
  return {
    write(record) {
      process.stderr.write(`${serializeRecord(record)}\n`);
    },
  };
}

function serializeRecord(record: StructuredLogRecord): string {
  return JSON.stringify({
    timestamp: record.timestamp.toISOString(),
    level: record.level,
    event: record.event,
    message: record.message,
    ...(record.executionId === undefined
      ? {}
      : { executionId: record.executionId }),
    attributes: record.attributes,
  });
}
