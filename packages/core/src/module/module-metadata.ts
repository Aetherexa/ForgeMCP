/**
 * Describes a Forge module.
 */
export interface ModuleMetadata {
  /**
   * Unique module name.
   */
  readonly name: string;

  /**
   * Module version.
   */
  readonly version?: string;

  /**
   * Optional description.
   */
  readonly description?: string;
}
