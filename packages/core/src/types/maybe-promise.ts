/**
 * Represents either a synchronous value or a Promise.
 */
export type MaybePromise<T> = T | Promise<T>;
