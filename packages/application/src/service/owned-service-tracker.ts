import type { ServiceToken } from "@forgemcp/core";

import {
  ServiceDisposalError,
  type ServiceDisposalFailure,
} from "./service-errors.js";

interface OwnedServiceEntry {
  readonly token: ServiceToken<unknown>;
  readonly value: unknown;
}

interface StandardDisposable {
  [Symbol.asyncDispose]?: () => PromiseLike<void> | void;
  [Symbol.dispose]?: () => void;
}

/**
 * Tracks successful factory results and disposes them in reverse construction
 * order.
 */
export class OwnedServiceTracker {
  private readonly entries: OwnedServiceEntry[] = [];
  private disposalPromise: Promise<void> | undefined;

  /**
   * Records one framework-owned factory result.
   */
  public track(token: ServiceToken<unknown>, value: unknown): void {
    if (this.disposalPromise !== undefined) {
      throw new Error("Cannot track services after disposal has started.");
    }

    this.entries.push({ token, value });
  }

  /**
   * Disposes every owned service at most once.
   */
  public [Symbol.asyncDispose](): Promise<void> {
    if (this.disposalPromise !== undefined) {
      return this.disposalPromise;
    }

    this.disposalPromise = this.disposeOwnedServices();
    return this.disposalPromise;
  }

  private async disposeOwnedServices(): Promise<void> {
    const failures: ServiceDisposalFailure[] = [];

    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];

      if (entry === undefined) {
        continue;
      }

      try {
        await disposeValue(entry.value);
      } catch (error) {
        failures.push({
          serviceDescription: entry.token.description,
          error,
        });
      }
    }

    this.entries.length = 0;

    if (failures.length > 0) {
      throw new ServiceDisposalError(failures);
    }
  }
}

async function disposeValue(value: unknown): Promise<void> {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    return;
  }

  const disposable = value as StandardDisposable;
  const asyncDispose = disposable[Symbol.asyncDispose];

  if (typeof asyncDispose === "function") {
    await asyncDispose.call(value);
    return;
  }

  const dispose = disposable[Symbol.dispose];

  if (typeof dispose === "function") {
    dispose.call(value);
  }
}
