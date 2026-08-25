import type { AtomRegistry } from "effect/unstable/reactivity";
import { AsyncResult } from "effect/unstable/reactivity";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const atoms = vi.hoisted(() => ({ preferences: {}, shells: {}, projects: {} }));

vi.mock("expo-notifications", () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
}));
vi.mock("react-native", () => ({
  AppState: { currentState: "background" },
  Platform: { OS: "android" },
}));
vi.mock("../../state/preferences", () => ({ mobilePreferencesAtom: atoms.preferences }));
vi.mock("../../state/threads", () => ({
  environmentThreadShells: { threadShellsAtom: atoms.shells },
}));
vi.mock("../../state/projects", () => ({
  environmentProjects: { projectsAtom: atoms.projects },
}));
vi.mock("../../state/atom-registry", () => ({ appAtomRegistry: {} }));

import { acquireLocalCompletionNotifications } from "./localCompletionNotifications";

function makeRegistry(input?: {
  readonly enabled?: boolean;
  readonly shells?: ReadonlyArray<Record<string, unknown>>;
}) {
  const values = new Map<object, unknown>([
    [
      atoms.preferences,
      AsyncResult.success({ localCompletionNotificationsEnabled: input?.enabled ?? true }),
    ],
    [atoms.shells, input?.shells ?? []],
    [atoms.projects, [{ environmentId: "env-1", id: "project-1", title: "T3 Code" }]],
  ]);
  const listeners = new Map<object, Set<() => void>>();
  const releasedAtoms: object[] = [];
  const subscribe = vi.fn((atom: object, listener: () => void) => {
    let atomListeners = listeners.get(atom);
    if (atomListeners === undefined) {
      atomListeners = new Set();
      listeners.set(atom, atomListeners);
    }
    atomListeners.add(listener);
    return () => {
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
    for (const listener of listeners.get(atom) ?? []) listener();
  };
  return { emit, registry, releasedAtoms, subscribe };
}

function shell(completedAt: string | null) {
  return {
    environmentId: "env-1",
    id: "thread-1",
    projectId: "project-1",
    title: "Add completion alerts",
    latestTurn: {
      state: completedAt === null ? "running" : "completed",
      completedAt,
    },
    session: completedAt === null ? { status: "running" } : { status: "ready" },
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    backgroundLiveness: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("local completion notifications", () => {
  it("schedules a device-local alert for a newly Done background thread", () => {
    const { emit, registry } = makeRegistry({ shells: [shell(null)] });
    const schedule = vi.fn(() => Promise.resolve());
    const release = acquireLocalCompletionNotifications(registry, {
      supported: true,
      isBackgrounded: () => true,
      schedule,
    });

    emit(atoms.shells, [shell("2026-08-24T10:05:00.000Z")]);

    expect(schedule).toHaveBeenCalledOnce();
    expect(schedule).toHaveBeenCalledWith({
      completion: expect.objectContaining({
        environmentId: "env-1",
        threadId: "thread-1",
        threadTitle: "Add completion alerts",
      }),
      projectTitle: "T3 Code",
    });
    release();
  });

  it("does not replay history or notify while the app is active", () => {
    const alreadyDone = shell("2026-08-24T10:05:00.000Z");
    const { emit, registry } = makeRegistry({ shells: [alreadyDone] });
    const schedule = vi.fn(() => Promise.resolve());
    const release = acquireLocalCompletionNotifications(registry, {
      supported: true,
      isBackgrounded: () => false,
      schedule,
    });

    emit(atoms.shells, [shell(null)]);
    emit(atoms.shells, [shell("2026-08-24T10:10:00.000Z")]);

    expect(schedule).not.toHaveBeenCalled();
    release();
  });

  it("shares one shell tracker between visible and headless owners", () => {
    const { registry, releasedAtoms, subscribe } = makeRegistry({ shells: [shell(null)] });
    const dependencies = {
      supported: true,
      isBackgrounded: () => true,
      schedule: vi.fn(() => Promise.resolve()),
    };

    const releaseVisible = acquireLocalCompletionNotifications(registry, dependencies);
    const releaseHeadless = acquireLocalCompletionNotifications(registry, dependencies);
    expect(subscribe).toHaveBeenCalledTimes(3);

    releaseVisible();
    expect(releasedAtoms).toHaveLength(0);
    releaseHeadless();
    expect(releasedAtoms).toHaveLength(3);
  });
});
