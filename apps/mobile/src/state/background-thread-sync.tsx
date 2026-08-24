import { hasLiveThreadWork } from "@t3tools/client-runtime/state/thread-settled";
import { AsyncResult, type AtomRegistry } from "effect/unstable/reactivity";
import { useEffect } from "react";

import { scopedThreadKey } from "../lib/scopedEntities";
import { mobilePreferencesAtom } from "./preferences";
import { appAtomRegistry } from "./atom-registry";
import { environmentThreadDetails, environmentThreadShells } from "./threads";

const coordinators = new WeakMap<
  AtomRegistry.AtomRegistry,
  { owners: number; readonly release: () => void }
>();

function startBackgroundThreadSync(registry: AtomRegistry.AtomRegistry): () => void {
  const detailSubscriptions = new Map<string, () => void>();

  const reconcile = () => {
    const preferences = registry.get(mobilePreferencesAtom);
    const enabled =
      AsyncResult.isSuccess(preferences) && preferences.value.syncWorkingThreadMessages === true;
    const desiredThreads = new Map(
      (enabled ? registry.get(environmentThreadShells.threadShellsAtom) : [])
        .filter(hasLiveThreadWork)
        .map((thread) => [scopedThreadKey(thread.environmentId, thread.id), thread] as const),
    );

    for (const [key, unsubscribe] of detailSubscriptions) {
      if (desiredThreads.has(key)) continue;
      unsubscribe();
      detailSubscriptions.delete(key);
    }
    for (const [key, thread] of desiredThreads) {
      if (detailSubscriptions.has(key)) continue;
      detailSubscriptions.set(
        key,
        registry.subscribe(
          environmentThreadDetails.detailAtom({
            environmentId: thread.environmentId,
            threadId: thread.id,
          }),
          () => {},
        ),
      );
    }
  };

  const unsubscribePreferences = registry.subscribe(mobilePreferencesAtom, reconcile);
  // The shell lease is also the root that keeps environments connected in the
  // Android headless runtime, even when detail syncing is disabled.
  const unsubscribeShells = registry.subscribe(environmentThreadShells.threadShellsAtom, reconcile);
  reconcile();

  return () => {
    unsubscribePreferences();
    unsubscribeShells();
    for (const unsubscribe of detailSubscriptions.values()) unsubscribe();
    detailSubscriptions.clear();
  };
}

/**
 * Shares one working-thread sync coordinator between the visible React tree
 * and Android's headless foreground-service runtime.
 */
export function acquireBackgroundThreadSync(registry: AtomRegistry.AtomRegistry): () => void {
  let shared = coordinators.get(registry);
  if (shared === undefined) {
    shared = { owners: 1, release: startBackgroundThreadSync(registry) };
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

/** Keeps message windows warm only while their threads have live work. */
export function BackgroundThreadSync() {
  useEffect(() => acquireBackgroundThreadSync(appAtomRegistry), []);

  return null;
}
