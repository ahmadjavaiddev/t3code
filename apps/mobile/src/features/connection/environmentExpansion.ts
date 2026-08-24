import type { EnvironmentId } from "@t3tools/contracts";

export function toggleExpandedEnvironment(
  current: EnvironmentId | null,
  selected: EnvironmentId,
): EnvironmentId | null {
  return current === selected ? null : selected;
}
