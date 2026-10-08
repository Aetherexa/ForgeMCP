import type { Module, ModuleBuilder } from "@forgemcp/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForgeApplicationBuilder } from "../builder/forge-application-builder.js";
import { createStderrJsonLogSink } from "./stderr-json-log-sink.js";
import { createStructuredLogListener } from "./structured-log-listener.js";

describe("stderr JSON structured logging integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not change tool behavior when JSON serialization fails", async () => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    class TestModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "run" },
          execute() {
            return { value: "ok" };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .observe(
        createStructuredLogListener({
          sink: createStderrJsonLogSink(),
          executionAttributeNames: ["unsafe"],
        }),
      )
      .use(TestModule)
      .build();

    await application.start();

    await expect(
      application.execute("run", undefined, {
        unsafe: 1n,
      }),
    ).resolves.toEqual({
      value: "ok",
    });

    await expect(application.stop()).resolves.toBeUndefined();
  });
});
