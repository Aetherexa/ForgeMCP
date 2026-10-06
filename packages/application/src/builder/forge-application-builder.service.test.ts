import {
  createServiceToken,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "./forge-application-builder.js";

describe("ForgeApplicationBuilder services", () => {
  it("makes registered values available during module composition", async () => {
    const messageToken = createServiceToken<string>("message");

    class MessageModule implements Module {
      public configure(builder: ModuleBuilder): void {
        const message = builder.services.require(messageToken);

        builder.tool({
          metadata: { name: "message" },
          execute() {
            return { value: message };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provide(messageToken, "hello")
      .use(MessageModule)
      .build();

    await application.start();

    const result = await application.execute<undefined, string>(
      "message",
      undefined,
    );

    expect(result.value).toBe("hello");
  });

  it("constructs configured services before module composition", async () => {
    const clientToken = createServiceToken<{ baseUrl: string }>("apiClient");

    class ApiModule implements Module {
      public configure(builder: ModuleBuilder): void {
        const client = builder.services.require(clientToken);

        builder.tool({
          metadata: { name: "api-url" },
          execute() {
            return { value: client.baseUrl };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .configure({
        "api.baseUrl": "https://example.test",
      })
      .provideFactory(clientToken, ({ configuration }) => ({
        baseUrl: configuration.require("api.baseUrl"),
      }))
      .use(ApiModule)
      .build();

    await application.start();

    const result = await application.execute<undefined, string>(
      "api-url",
      undefined,
    );

    expect(result.value).toBe("https://example.test");
  });

  it("does not construct scoped or transient services during startup", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    const transientToken = createServiceToken<object>("transient");
    let constructions = 0;

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, () => {
        constructions += 1;
        return {};
      })
      .provideTransientFactory(transientToken, () => {
        constructions += 1;
        return {};
      })
      .build();

    await application.start();

    expect(constructions).toBe(0);
  });

  it("rejects duplicate service registration while building the app", () => {
    const token = createServiceToken<string>("service");
    const builder = ForgeApplicationBuilder.create().provide(token, "one");

    expect(() => builder.provide(token, "two")).toThrow(
      "Service 'service' is already registered.",
    );
  });
});
