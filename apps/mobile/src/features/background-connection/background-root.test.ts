import type { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";

import { acquireBackgroundConnectionRoot } from "./background-root";

const mocks = vi.hoisted(() => ({ release: vi.fn() }));

vi.mock("../../state/background-thread-sync", () => ({
  acquireBackgroundThreadSync: vi.fn(() => mocks.release),
}));

import { acquireBackgroundThreadSync } from "../../state/background-thread-sync";

function makeRegistry() {
  return {
    registry: {} as AtomRegistry.AtomRegistry,
  };
}

describe("background connection root", () => {
  it("retains the shared working-thread sync coordinator", () => {
    const { registry } = makeRegistry();
    const releaseRoot = acquireBackgroundConnectionRoot(registry);

    expect(acquireBackgroundThreadSync).toHaveBeenCalledWith(registry);
    expect(releaseRoot).toBe(mocks.release);
  });
});
