import type {
  ConfigurationSource,
  Module,
  ModuleBuilder,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "./forge-application-builder.js";

describe("ForgeApplicationBuilder configuration", () => {
  it("provides explicit configuration during module composition", async () => {
    class ConfiguredModule implements Module {
      public configure(builder: ModuleBuilder): void {
        const value = builder.configuration.require("service.url");

        builder.tool({
          metadata: { name: "configured-value" },
          execute() {
            return { value };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .configure({
        "service.url": "https://example.com",
      })
      .use(ConfiguredModule)
      .build();

    await application.start();

    const result = await application.execute<undefined, string>(
      "configured-value",
      undefined,
    );

    expect(result.value).toBe("https://example.com");
  });

  it("applies configuration sources in registration order", async () => {
    const override: ConfigurationSource = {
      load() {
        return {
          "service.url": "https://override.example",
        };
      },
    };

    class ConfiguredModule implements Module {
      public configure(builder: ModuleBuilder): void {
        const value = builder.configuration.require("service.url");

        builder.tool({
          metadata: { name: "service-url" },
          execute() {
            return { value };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .configure({
        "service.url": "https://default.example",
      })
      .configureFrom(override)
      .use(ConfiguredModule)
      .build();

    await application.start();

    const result = await application.execute<undefined, string>(
      "service-url",
      undefined,
    );

    expect(result.value).toBe("https://override.example");
  });

  it("captures explicit configuration before caller mutation", async () => {
    const values: Record<string, string> = {
      "feature.mode": "safe",
    };

    class ConfiguredModule implements Module {
      public configure(builder: ModuleBuilder): void {
        const mode = builder.configuration.require("feature.mode");

        builder.tool({
          metadata: { name: "mode" },
          execute() {
            return { value: mode };
          },
        });
      }
    }

    const builder = ForgeApplicationBuilder.create()
      .configure(values)
      .use(ConfiguredModule);

    values["feature.mode"] = "mutated";

    const application = builder.build();
    await application.start();

    const result = await application.execute<undefined, string>(
      "mode",
      undefined,
    );

    expect(result.value).toBe("safe");
  });
});
