import type { MaybePromise } from "./maybe-promise.js";

/**
 * Represents a resource that can be disposed.
 */
export interface Disposable {
  dispose(): MaybePromise<void>;
}

/**
 * Represents an asynchronously disposable resource.
 */
export interface AsyncDisposable {
  disposeAsync(): Promise<void>;
}
