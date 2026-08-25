import {
  updateThreadCompletionNotificationTracker,
  type ThreadCompletionNotificationItem,
  type ThreadCompletionNotificationTracker,
} from "@t3tools/client-runtime/state/thread-completion-notifications";
import * as Notifications from "expo-notifications";
import { AsyncResult, type AtomRegistry } from "effect/unstable/reactivity";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { environmentProjects } from "../../state/projects";
import { appAtomRegistry } from "../../state/atom-registry";
import { mobilePreferencesAtom } from "../../state/preferences";
import { environmentThreadShells } from "../../state/threads";

const COMPLETION_NOTIFICATION_CHANNEL_ID = "thread-completions";

export type LocalCompletionNotificationPermission =
  | { readonly type: "unsupported" }
  | { readonly type: "granted" }
  | { readonly type: "denied"; readonly canAskAgain: boolean };

let channelPromise: Promise<unknown> | null = null;

function ensureCompletionNotificationChannel(): Promise<unknown> {
  if (Platform.OS !== "android") {
    return Promise.resolve();
  }
  channelPromise ??= Notifications.setNotificationChannelAsync(COMPLETION_NOTIFICATION_CHANNEL_ID, {
    name: "Task completions",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  }).catch((error) => {
    channelPromise = null;
    throw error;
  });
  return channelPromise;
}

export async function readLocalCompletionNotificationPermission(): Promise<LocalCompletionNotificationPermission> {
  if (Platform.OS !== "android") {
    return { type: "unsupported" };
  }
  await ensureCompletionNotificationChannel();
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted
    ? { type: "granted" }
    : { type: "denied", canAskAgain: permission.canAskAgain };
}

export async function requestLocalCompletionNotificationPermission(): Promise<LocalCompletionNotificationPermission> {
  if (Platform.OS !== "android") {
    return { type: "unsupported" };
  }
  await ensureCompletionNotificationChannel();
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return { type: "granted" };
  }
  if (!existing.canAskAgain) {
    return { type: "denied", canAskAgain: false };
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted
    ? { type: "granted" }
    : { type: "denied", canAskAgain: requested.canAskAgain };
}

function localCompletionDeepLink(completion: ThreadCompletionNotificationItem): string {
  return `/threads/${encodeURIComponent(completion.environmentId)}/${encodeURIComponent(
    completion.threadId,
  )}`;
}

async function scheduleLocalCompletionNotification(input: {
  readonly completion: ThreadCompletionNotificationItem;
  readonly projectTitle: string | undefined;
}): Promise<void> {
  await ensureCompletionNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Task completed",
      body: input.projectTitle
        ? `${input.completion.threadTitle} · ${input.projectTitle}`
        : input.completion.threadTitle,
      data: {
        deepLink: localCompletionDeepLink(input.completion),
        environmentId: input.completion.environmentId,
        threadId: input.completion.threadId,
        source: "local",
      },
      sound: "default",
    },
    trigger: { channelId: COMPLETION_NOTIFICATION_CHANNEL_ID },
  });
}

interface LocalCompletionNotificationDependencies {
  readonly supported: boolean;
  readonly isBackgrounded: () => boolean;
  readonly schedule: (input: {
    readonly completion: ThreadCompletionNotificationItem;
    readonly projectTitle: string | undefined;
  }) => Promise<void>;
}

const nativeDependencies: LocalCompletionNotificationDependencies = {
  supported: Platform.OS === "android",
  isBackgrounded: () => AppState.currentState !== "active",
  schedule: scheduleLocalCompletionNotification,
};

const coordinators = new WeakMap<
  AtomRegistry.AtomRegistry,
  { owners: number; readonly release: () => void }
>();

function startLocalCompletionNotifications(
  registry: AtomRegistry.AtomRegistry,
  dependencies: LocalCompletionNotificationDependencies,
): () => void {
  let tracker: ThreadCompletionNotificationTracker | null = null;

  const reconcile = () => {
    const preferences = registry.get(mobilePreferencesAtom);
    const enabled =
      AsyncResult.isSuccess(preferences) &&
      preferences.value.localCompletionNotificationsEnabled === true;
    if (!enabled) {
      tracker = null;
      return;
    }

    const update = updateThreadCompletionNotificationTracker(
      tracker,
      registry.get(environmentThreadShells.threadShellsAtom),
    );
    tracker = update.tracker;
    if (!dependencies.isBackgrounded()) {
      return;
    }

    const projectTitleByKey = new Map(
      registry
        .get(environmentProjects.projectsAtom)
        .map((project) => [`${project.environmentId}:${project.id}`, project.title] as const),
    );
    for (const completion of update.completions) {
      void dependencies
        .schedule({
          completion,
          projectTitle: projectTitleByKey.get(
            `${completion.environmentId}:${completion.projectId}`,
          ),
        })
        .catch((error) => {
          console.warn("[local-completion-notification] delivery failed", error);
        });
    }
  };

  const unsubscribePreferences = registry.subscribe(mobilePreferencesAtom, reconcile);
  const unsubscribeShells = registry.subscribe(environmentThreadShells.threadShellsAtom, reconcile);
  const unsubscribeProjects = registry.subscribe(environmentProjects.projectsAtom, reconcile);
  reconcile();

  return () => {
    unsubscribePreferences();
    unsubscribeShells();
    unsubscribeProjects();
  };
}

export function acquireLocalCompletionNotifications(
  registry: AtomRegistry.AtomRegistry,
  dependencies: LocalCompletionNotificationDependencies = nativeDependencies,
): () => void {
  if (!dependencies.supported) {
    return () => {};
  }

  let shared = coordinators.get(registry);
  if (shared === undefined) {
    shared = { owners: 1, release: startLocalCompletionNotifications(registry, dependencies) };
    coordinators.set(registry, shared);
  } else {
    shared.owners += 1;
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = coordinators.get(registry);
    if (current === undefined) return;
    current.owners -= 1;
    if (current.owners > 0) return;
    coordinators.delete(registry);
    current.release();
  };
}

export function LocalCompletionNotifications() {
  useEffect(() => acquireLocalCompletionNotifications(appAtomRegistry), []);
  return null;
}
