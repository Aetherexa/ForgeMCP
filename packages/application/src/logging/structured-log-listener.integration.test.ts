import type { Module, ModuleBuilder } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "../builder/forge-application-builder.js";
import { createStructuredLogListener } from "./structured-log-listener.js";

describe("structured logging integration", () => {
  it("does not change application behavior when the sink throws", async () => {
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
          sink: {
            write() {
              throw new Error("logging failed");
            },
          },
        }),
      )
      .use(TestModule)
      .build();

    await expect(application.start()).resolves.toBeUndefined();
    await expect(application.execute("run", undefined)).resolves.toEqual({
      value: "ok",
    });
    await expect(application.stop()).resolves.toBeUndefined();
  });
});
