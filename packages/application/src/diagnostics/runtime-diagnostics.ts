import {
  DiagnosticEventNames as Events,
  LifecycleState,
  type DiagnosticEventName,
  type RuntimeDiagnostics,
} from "@forgemcp/core";

const states: Partial<Record<DiagnosticEventName, LifecycleState>> = {
  [Events.ApplicationStarting]: LifecycleState.Starting,
  [Events.ApplicationStarted]: LifecycleState.Started,
  [Events.ApplicationStartFailed]: LifecycleState.Created,
  [Events.ApplicationStopping]: LifecycleState.Stopping,
  [Events.ApplicationStopped]: LifecycleState.Stopped,
  [Events.ApplicationStopFailed]: LifecycleState.Stopped,
};

/** One provider per application. Retains only IDs of currently active calls. */
export function createRuntimeDiagnostics(): RuntimeDiagnostics {
  let state = LifecycleState.Created;
  let completedExecutions = 0;
  let failedExecutions = 0;
  const active = new Set<string>();
  return Object.freeze({
    listener: Object.freeze({
      onEvent(event: Parameters<RuntimeDiagnostics["listener"]["onEvent"]>[0]) {
        const nextState = states[event.name];
        if (nextState !== undefined) {
          state = nextState;
          if (
            state === LifecycleState.Created ||
            state === LifecycleState.Stopped
          )
            active.clear();
          return;
        }
        const id = event.execution?.id;
        if (id === undefined) return;
        if (event.name === Events.ExecutionStarted) active.add(id);
        else if (active.delete(id)) {
          if (event.name === Events.ExecutionCompleted)
            completedExecutions += 1;
          else if (event.name === Events.ExecutionFailed) failedExecutions += 1;
        }
      },
    }),
    snapshot() {
      return Object.freeze({
        state,
        activeExecutions: active.size,
        completedExecutions,
        failedExecutions,
      });
    },
  });
}
