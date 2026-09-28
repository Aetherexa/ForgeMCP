import {
  type Application,
  LifecycleState,
  type ModuleType,
} from "@forgemcp/core";

/**
 * Default implementation of a Forge application.
 */
export class ForgeApplication implements Application {
  private currentState = LifecycleState.Created;

  /**
   * Creates a new Forge application.
   */
  public constructor(
    private readonly modules: readonly ModuleType[],
  ) {}

  /**
   * Current lifecycle state.
   */
  public get state(): LifecycleState {
    return this.currentState;
  }

  /**
   * Starts the application.
   *
   * Starting an already started application is idempotent.
   * A stopped application is terminal and cannot be started again.
   */
  public async start(): Promise<void> {
    if (this.currentState === LifecycleState.Started) {
      return;
    }

    if (this.currentState !== LifecycleState.Created) {
      throw new Error(
        `Cannot start application while lifecycle state is '${this.currentState}'.`,
      );
    }

    this.currentState = LifecycleState.Starting;

    try {
      this.currentState = LifecycleState.Started;
    } catch (error) {
      this.currentState = LifecycleState.Created;
      throw error;
    }
  }

  /**
   * Stops the application.
   *
   * Stopping a created or already stopped application is safe and idempotent.
   */
  public async stop(): Promise<void> {
    if (this.currentState === LifecycleState.Stopped) {
      return;
    }

    if (this.currentState === LifecycleState.Created) {
      this.currentState = LifecycleState.Stopped;
      return;
    }

    if (this.currentState !== LifecycleState.Started) {
      throw new Error(
        `Cannot stop application while lifecycle state is '${this.currentState}'.`,
      );
    }

    this.currentState = LifecycleState.Stopping;

    try {
      this.currentState = LifecycleState.Stopped;
    } catch (error) {
      this.currentState = LifecycleState.Started;
      throw error;
    }
  }
}
