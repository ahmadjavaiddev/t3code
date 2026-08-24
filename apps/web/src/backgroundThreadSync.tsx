import { useEffect, useMemo } from "react";
import { hasLiveThreadWork } from "@t3tools/client-runtime/state/thread-settled";

import { useClientSettings } from "./hooks/useSettings";
import { appAtomRegistry } from "./rpc/atomRegistry";
import { useThreadShells } from "./state/entities";
import { environmentThreadDetails } from "./state/threads";

/** Keeps message windows warm only while their threads have live work. */
export function BackgroundThreadSync() {
  const enabled = useClientSettings((settings) => settings.syncWorkingThreadMessages);
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
