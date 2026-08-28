import { hasLiveThreadWork } from "@t3tools/client-runtime/state/thread-settled";
import { AsyncResult, type AtomRegistry } from "effect/unstable/reactivity";
import { useEffect } from "react";

import { scopedThreadKey } from "../lib/scopedEntities";
import { mobilePreferencesAtom } from "./preferences";
import { appAtomRegistry } from "./atom-registry";
import { environmentThreadDetails, environmentThreadShells } from "./threads";

interface BackgroundThreadSyncCoordinator {
  owners: number;
  detailOwners: number;
  readonly setDetailSyncOwners: (owners: number) => void;
  readonly reconcile: () => void;
  readonly release: () => void;
}

const coordinators = new WeakMap<AtomRegistry.AtomRegistry, BackgroundThreadSyncCoordinator>();

function startBackgroundThreadSync(
  registry: AtomRegistry.AtomRegistry,
  initialDetailSync: boolean,
): BackgroundThreadSyncCoordinator {
  const detailSubscriptions = new Map<string, () => void>();
  let detailSyncOwners = initialDetailSync ? 1 : 0;

  const reconcile = () => {
    const preferences = registry.get(mobilePreferencesAtom);
    const enabled =
      AsyncResult.isSuccess(preferences) && preferences.value.syncWorkingThreadMessages === true;
    const desiredThreads = new Map(
      (enabled && detailSyncOwners > 0
        ? registry.get(environmentThreadShells.threadShellsAtom)
        : []
      )
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

  return {
    owners: 1,
    detailOwners: detailSyncOwners,
    setDetailSyncOwners: (owners) => {
      detailSyncOwners = owners;
      reconcile();
    },
    reconcile,
    release: () => {
      unsubscribePreferences();
      unsubscribeShells();
      for (const unsubscribe of detailSubscriptions.values()) unsubscribe();
      detailSubscriptions.clear();
    },
  };
}

/**
 * Shares one working-thread sync coordinator between the visible React tree
 * and Android's headless foreground-service runtime.
 */
export function acquireBackgroundThreadSync(
  registry: AtomRegistry.AtomRegistry,
  options: { readonly syncDetails?: boolean } = {},
): () => void {
  const syncDetails = options.syncDetails !== false;
  let shared = coordinators.get(registry);
  if (shared === undefined) {
    shared = startBackgroundThreadSync(registry, syncDetails);
    coordinators.set(registry, shared);
  } else {
    shared.owners += 1;
    if (syncDetails) {
      shared.detailOwners += 1;
      // The coordinator was possibly created by the visible owner. Reconcile
      // immediately when a headless owner joins the same JS registry.
      shared.setDetailSyncOwners(shared.detailOwners);
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = coordinators.get(registry);
    if (current === undefined) return;
    current.owners -= 1;
    if (syncDetails) {
      current.detailOwners = Math.max(0, current.detailOwners - 1);
      current.setDetailSyncOwners(current.detailOwners);
    }
    if (current.owners > 0) return;
    coordinators.delete(registry);
    current.release();
  };
}

/** Keeps message windows warm only while their threads have live work. */
export function BackgroundThreadSync() {
  // The visible app already owns the selected thread's detail subscription.
  // Do not keep every working thread's full message stream hot on the UI
  // runtime; the headless background owner acquires detail sync when Android
  // actually moves the app off-screen.
  useEffect(() => acquireBackgroundThreadSync(appAtomRegistry, { syncDetails: false }), []);

  return null;
}
