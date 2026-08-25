import type { AtomRegistry } from "effect/unstable/reactivity";

import { acquireBackgroundThreadSync } from "../../state/background-thread-sync";
import { acquireLocalCompletionNotifications } from "../notifications/localCompletionNotifications";

export function acquireBackgroundConnectionRoot(registry: AtomRegistry.AtomRegistry): () => void {
  const releaseThreadSync = acquireBackgroundThreadSync(registry);
  const releaseCompletionNotifications = acquireLocalCompletionNotifications(registry);
  return () => {
    releaseCompletionNotifications();
    releaseThreadSync();
  };
}
