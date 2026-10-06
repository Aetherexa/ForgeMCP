import {
  createServiceToken,
  type Middleware,
  type Module,
  type ModuleBuilder,
} from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ForgeApplicationBuilder } from "../builder/forge-application-builder.js";

describe("ForgeApplication execution service scopes", () => {
  it("shares one scoped service between middleware and the tool", async () => {
    const scopedToken = createServiceToken<object>("scoped");
    let constructions = 0;
    let middlewareService: object | undefined;
    let toolService: object | undefined;

    const middleware: Middleware = {
      async invoke(context, input, next) {
        middlewareService = await context.services.require(scopedToken);
        return next(input);
      },
    };

    class ScopeModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.middleware(middleware);
        builder.tool({
          metadata: { name: "scope" },
          async execute(context) {
            toolService = await context.services.require(scopedToken);
            return { value: "ok" };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, () => {
        constructions += 1;
        return {};
      })
      .use(ScopeModule)
      .build();

    await application.start();
    await application.execute("scope", undefined);

    expect(middlewareService).toBeDefined();
    expect(toolService).toBe(middlewareService);
    expect(constructions).toBe(1);
  });

  it("isolates scoped services across sequential executions while reusing application services", async () => {
    const applicationToken = createServiceToken<object>("application");
    const scopedToken = createServiceToken<{
      id: number;
      application: object;
    }>("scoped");
    const applicationService = {};
    let constructions = 0;

    class ScopeModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "scope" },
          async execute(context) {
            return {
              value: await context.services.require(scopedToken),
            };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provide(applicationToken, applicationService)
      .provideScopedFactory(scopedToken, async ({ services }) => ({
        id: ++constructions,
        application: await services.require(applicationToken),
      }))
      .use(ScopeModule)
      .build();

    await application.start();

    const first = await application.execute<
      undefined,
      { id: number; application: object }
    >("scope", undefined);
    const second = await application.execute<
      undefined,
      { id: number; application: object }
    >("scope", undefined);

    expect(first.value).not.toBe(second.value);
    expect(first.value.id).toBe(1);
    expect(second.value.id).toBe(2);
    expect(first.value.application).toBe(applicationService);
    expect(second.value.application).toBe(applicationService);
    expect(constructions).toBe(2);
  });

  it("isolates scoped services across concurrent executions", async () => {
    const scopedToken = createServiceToken<{ id: number }>("scoped");
    let constructions = 0;
    let entered = 0;
    let releaseExecution: (() => void) | undefined;
    const bothEntered = new Promise<void>((resolve) => {
      releaseExecution = resolve;
    });

    class ScopeModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "scope" },
          async execute(context) {
            const scoped = await context.services.require(scopedToken);
            entered += 1;

            if (entered === 2) {
              releaseExecution?.();
            }

            await bothEntered;
            return { value: scoped.id };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, async () => {
        const id = ++constructions;
        await Promise.resolve();
        return { id };
      })
      .use(ScopeModule)
      .build();

    await application.start();

    const [first, second] = await Promise.all([
      application.execute<undefined, number>("scope", undefined),
      application.execute<undefined, number>("scope", undefined),
    ]);

    expect(new Set([first.value, second.value])).toEqual(new Set([1, 2]));
    expect(constructions).toBe(2);
  });

  it("creates a new transient service for each resolution in one execution", async () => {
    const transientToken = createServiceToken<object>("transient");
    let constructions = 0;

    class TransientModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "transient" },
          async execute(context) {
            const first = await context.services.require(transientToken);
            const second = await context.services.require(transientToken);

            return { value: first === second };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideTransientFactory(transientToken, () => {
        constructions += 1;
        return {};
      })
      .use(TransientModule)
      .build();

    await application.start();

    const result = await application.execute<undefined, boolean>(
      "transient",
      undefined,
    );

    expect(result.value).toBe(false);
    expect(constructions).toBe(2);
  });

  it("does not reuse scoped state after a failed execution", async () => {
    const scopedToken = createServiceToken<{ id: number }>("scoped");
    let constructions = 0;

    class FailingModule implements Module {
      public configure(builder: ModuleBuilder): void {
        builder.tool({
          metadata: { name: "scope" },
          async execute(context, input) {
            const scoped = await context.services.require(scopedToken);

            if (input === "fail") {
              throw new Error(`execution failed in scope ${scoped.id}`);
            }

            return { value: scoped.id };
          },
        });
      }
    }

    const application = ForgeApplicationBuilder.create()
      .provideScopedFactory(scopedToken, () => ({
        id: ++constructions,
      }))
      .use(FailingModule)
      .build();

    await application.start();

    await expect(application.execute("scope", "fail")).rejects.toThrow(
      "execution failed in scope 1",
    );

    const recovered = await application.execute<string, number>(
      "scope",
      "recover",
    );

    expect(recovered.value).toBe(2);
    expect(constructions).toBe(2);
  });
});
