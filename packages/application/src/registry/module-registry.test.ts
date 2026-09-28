import type { Module, ModuleBuilder } from "@forgemcp/core";
import { describe, expect, it } from "vitest";

import { ModuleRegistry } from "./module-registry.js";

class FirstModule implements Module {
  public configure(_builder: ModuleBuilder): void {}
}

class SecondModule implements Module {
  public configure(_builder: ModuleBuilder): void {}
}

describe("ModuleRegistry", () => {
  it("stores modules in registration order", () => {
    const registry = new ModuleRegistry();

    registry.register(FirstModule);
    registry.register(SecondModule);

    expect(registry.size).toBe(2);
    expect(registry.getAll()).toEqual([FirstModule, SecondModule]);
  });

  it("ignores duplicate registrations", () => {
    const registry = new ModuleRegistry();

    registry.register(FirstModule);
    registry.register(FirstModule);

    expect(registry.size).toBe(1);
  });

  it("reports whether a module is registered", () => {
    const registry = new ModuleRegistry();

    registry.register(FirstModule);

    expect(registry.has(FirstModule)).toBe(true);
    expect(registry.has(SecondModule)).toBe(false);
  });

  it("clears all modules", () => {
    const registry = new ModuleRegistry();

    registry.register(FirstModule);
    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAll()).toEqual([]);
  });
});
