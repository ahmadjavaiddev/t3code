import { useAtomValue } from "@effect/atom-react";
import { hasLiveThreadWork } from "@t3tools/client-runtime/state/thread-settled";
import { AsyncResult } from "effect/unstable/reactivity";
import { useEffect, useMemo } from "react";

import { mobilePreferencesAtom } from "./preferences";
import { appAtomRegistry } from "./atom-registry";
import { useThreadShells } from "./entities";
import { environmentThreadDetails } from "./threads";

/** Keeps message windows warm only while their threads have live work. */
export function BackgroundThreadSync() {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const enabled =
    AsyncResult.isSuccess(preferences) && preferences.value.syncWorkingThreadMessages === true;
  const threadShells = useThreadShells();
  const workingThreads = useMemo(() => threadShells.filter(hasLiveThreadWork), [threadShells]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribes = workingThreads.map((thread) =>
      appAtomRegistry.subscribe(
        environmentThreadDetails.detailAtom({
          environmentId: thread.environmentId,
          threadId: thread.id,
        }),
        () => {},
      ),
    );
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [enabled, workingThreads]);

  return null;
}
