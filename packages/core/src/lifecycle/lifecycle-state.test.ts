import { describe, expect, it } from "vitest";

import { LifecycleState } from "./lifecycle-state.js";

describe("LifecycleState", () => {
  it("keeps stable serialized state values", () => {
    expect(LifecycleState).toEqual({
      Created: "created",
      Starting: "starting",
      Started: "started",
      Stopping: "stopping",
      Stopped: "stopped",
    });
  });
});
