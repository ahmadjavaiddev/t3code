import type { AtomRegistry } from "effect/unstable/reactivity";

import { acquireBackgroundThreadSync } from "../../state/background-thread-sync";

export function acquireBackgroundConnectionRoot(registry: AtomRegistry.AtomRegistry): () => void {
  return acquireBackgroundThreadSync(registry);
}
