import type { ModuleConstructor } from "@forgemcp/core";

/**
 * Maintains the collection of application module constructors.
 *
 * The registry stores unique module types in registration order.
 */
export class ModuleRegistry {
  private readonly modules = new Set<ModuleConstructor>();

  /**
   * Registers a module.
   *
   * Duplicate registrations are ignored.
   */
  public register(module: ModuleConstructor): void {
    this.modules.add(module);
  }

  /**
   * Determines whether a module has already been registered.
   */
  public has(module: ModuleConstructor): boolean {
    return this.modules.has(module);
  }

  /**
   * Returns every registered module.
   */
  public getAll(): readonly ModuleConstructor[] {
    return [...this.modules];
  }

  /**
   * Number of registered modules.
   */
  public get size(): number {
    return this.modules.size;
  }

  /**
   * Removes every registered module.
   *
   * Mainly useful for testing.
   */
  public clear(): void {
    this.modules.clear();
  }
}
