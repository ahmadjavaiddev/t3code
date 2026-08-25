import type { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";

import { acquireBackgroundConnectionRoot } from "./background-root";

const mocks = vi.hoisted(() => ({ releaseSync: vi.fn(), releaseNotifications: vi.fn() }));

vi.mock("../../state/background-thread-sync", () => ({
  acquireBackgroundThreadSync: vi.fn(() => mocks.releaseSync),
}));
vi.mock("../notifications/localCompletionNotifications", () => ({
  acquireLocalCompletionNotifications: vi.fn(() => mocks.releaseNotifications),
}));

import { acquireBackgroundThreadSync } from "../../state/background-thread-sync";
import { acquireLocalCompletionNotifications } from "../notifications/localCompletionNotifications";

function makeRegistry() {
  return {
    registry: {} as AtomRegistry.AtomRegistry,
  };
}

describe("background connection root", () => {
  it("retains thread sync and local completion notifications", () => {
    const { registry } = makeRegistry();
    const releaseRoot = acquireBackgroundConnectionRoot(registry);

    expect(acquireBackgroundThreadSync).toHaveBeenCalledWith(registry);
    expect(acquireLocalCompletionNotifications).toHaveBeenCalledWith(registry);

    releaseRoot();
    expect(mocks.releaseNotifications).toHaveBeenCalledOnce();
    expect(mocks.releaseSync).toHaveBeenCalledOnce();
  });
});
