import type { AtomRegistry } from "effect/unstable/reactivity";

import { acquireLocalCompletionNotifications } from "../notifications/localCompletionNotifications";

export function acquireBackgroundConnectionRoot(registry: AtomRegistry.AtomRegistry): () => void {
  const releaseCompletionNotifications = acquireLocalCompletionNotifications(registry);
  return () => {
    releaseCompletionNotifications();
  };
}
