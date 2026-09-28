import type { Module, ModuleBuilder } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "./forge-application-builder.js";

class TestModule implements Module {
  public configure(builder: ModuleBuilder): void {
    builder.tool({
      metadata: { name: "ping" },
      execute() {
        return { value: "pong" };
      },
    });
  }
}

describe("ForgeApplicationBuilder", () => {
  it("builds an application from registered modules", async () => {
    const application = ForgeApplicationBuilder.create()
      .use(TestModule)
      .build();

    await application.start();

    const result = await application.execute<undefined, string>(
      "ping",
      undefined,
    );

    expect(result.value).toBe("pong");
  });

  it("rejects duplicate module registration", () => {
    const builder = ForgeApplicationBuilder.create().use(TestModule);

    expect(() => builder.use(TestModule)).toThrow(
      "Module 'TestModule' is already registered.",
    );
  });
});
