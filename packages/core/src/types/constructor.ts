/**
 * Represents a class constructor.
 */
export type Constructor<T = object> = abstract new (...args: never[]) => T;
