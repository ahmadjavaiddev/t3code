import type { AtomRegistry } from "effect/unstable/reactivity";
import { AsyncResult } from "effect/unstable/reactivity";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const atoms = vi.hoisted(() => {
  const detailAtoms = new Map<string, object>();
  return {
    preferences: {},
    shells: {},
    detailAtoms,
    detailAtom: vi.fn((ref: { environmentId: string; threadId: string }) => {
      const key = `${ref.environmentId}:${ref.threadId}`;
      let atom = detailAtoms.get(key);
      if (atom === undefined) {
        atom = {};
        detailAtoms.set(key, atom);
      }
      return atom;
    }),
  };
});

vi.mock("./preferences", () => ({ mobilePreferencesAtom: atoms.preferences }));
vi.mock("./threads", () => ({
  environmentThreadShells: { threadShellsAtom: atoms.shells },
  environmentThreadDetails: { detailAtom: atoms.detailAtom },
}));

import { acquireBackgroundThreadSync } from "./background-thread-sync";

function makeRegistry(initialPreferences: unknown, initialShells: unknown) {
  const values = new Map<object, unknown>([
    [atoms.preferences, initialPreferences],
    [atoms.shells, initialShells],
  ]);
  const listeners = new Map<object, Set<(value: unknown) => void>>();
  const releasedAtoms: object[] = [];
  const subscribe = vi.fn((atom: object, listener: (value: unknown) => void) => {
    let atomListeners = listeners.get(atom);
    if (atomListeners === undefined) {
      atomListeners = new Set();
      listeners.set(atom, atomListeners);
    }
    atomListeners.add(listener);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      atomListeners.delete(listener);
      releasedAtoms.push(atom);
    };
  });
  const registry = {
    get: (atom: object) => values.get(atom),
    subscribe,
  } as unknown as AtomRegistry.AtomRegistry;
  const emit = (atom: object, value: unknown) => {
    values.set(atom, value);
    for (const listener of listeners.get(atom) ?? []) listener(value);
  };
  return { emit, registry, releasedAtoms, subscribe };
}

const liveThread = {
  environmentId: "environment-1",
  id: "thread-live",
  session: { status: "running" },
  backgroundLiveness: null,
};
const quietThread = {
  environmentId: "environment-1",
  id: "thread-quiet",
  session: null,
  backgroundLiveness: null,
};

beforeEach(() => {
  atoms.detailAtoms.clear();
  atoms.detailAtom.mockClear();
});

describe("background working-thread sync", () => {
  it("retains detail subscriptions only for live work while enabled", () => {
    const enabled = AsyncResult.success({ syncWorkingThreadMessages: true });
    const disabled = AsyncResult.success({ syncWorkingThreadMessages: false });
    const { emit, registry, releasedAtoms } = makeRegistry(enabled, [liveThread, quietThread]);

    const release = acquireBackgroundThreadSync(registry);
    const liveDetailAtom = atoms.detailAtoms.get("environment-1:thread-live");
    expect(liveDetailAtom).toBeDefined();
    expect(atoms.detailAtoms.has("environment-1:thread-quiet")).toBe(false);

    emit(atoms.shells, [quietThread]);
    expect(releasedAtoms).toContain(liveDetailAtom);

    emit(atoms.shells, [{ ...quietThread, backgroundLiveness: "monitoring" }]);
    const quietDetailAtom = atoms.detailAtoms.get("environment-1:thread-quiet");
    expect(quietDetailAtom).toBeDefined();

    emit(atoms.preferences, disabled);
    expect(releasedAtoms).toContain(quietDetailAtom);

    release();
    expect(releasedAtoms).toContain(atoms.preferences);
    expect(releasedAtoms).toContain(atoms.shells);
  });

  it("shares one coordinator between visible and headless owners", () => {
    const { registry, releasedAtoms, subscribe } = makeRegistry(
      AsyncResult.success({ syncWorkingThreadMessages: true }),
      [liveThread],
    );

    const releaseVisible = acquireBackgroundThreadSync(registry);
    const releaseHeadless = acquireBackgroundThreadSync(registry);
    expect(subscribe).toHaveBeenCalledTimes(3);

    releaseVisible();
    expect(releasedAtoms).toHaveLength(0);
    releaseHeadless();
    expect(releasedAtoms).toHaveLength(3);
  });

  it("does not subscribe to full details for the visible UI owner", () => {
    const { registry, subscribe } = makeRegistry(
      AsyncResult.success({ syncWorkingThreadMessages: true }),
      [liveThread],
    );

    acquireBackgroundThreadSync(registry, { syncDetails: false });

    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(atoms.detailAtom).not.toHaveBeenCalled();
  });

  it("adds detail syncing when a headless owner joins a visible owner", () => {
    const { registry, subscribe } = makeRegistry(
      AsyncResult.success({ syncWorkingThreadMessages: true }),
      [liveThread],
    );

    const releaseVisible = acquireBackgroundThreadSync(registry, { syncDetails: false });
    expect(subscribe).toHaveBeenCalledTimes(2);

    const releaseHeadless = acquireBackgroundThreadSync(registry, { syncDetails: true });
    expect(subscribe).toHaveBeenCalledTimes(3);

    releaseHeadless();
    releaseVisible();
  });
});
