import type { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vite-plus/test";

import { acquireBackgroundConnectionRoot } from "./background-root";

const mocks = vi.hoisted(() => ({ releaseNotifications: vi.fn() }));

vi.mock("../notifications/localCompletionNotifications", () => ({
  acquireLocalCompletionNotifications: vi.fn(() => mocks.releaseNotifications),
}));

import { acquireLocalCompletionNotifications } from "../notifications/localCompletionNotifications";

function makeRegistry() {
  return {
    registry: {} as AtomRegistry.AtomRegistry,
  };
}

describe("background connection root", () => {
  it("retains local completion notifications without a message sync lease", () => {
    const { registry } = makeRegistry();
    const releaseRoot = acquireBackgroundConnectionRoot(registry);

    expect(acquireLocalCompletionNotifications).toHaveBeenCalledWith(registry);

    releaseRoot();
    expect(mocks.releaseNotifications).toHaveBeenCalledOnce();
  });
});
