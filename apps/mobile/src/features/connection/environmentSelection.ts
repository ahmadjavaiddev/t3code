import type { EnvironmentId } from "@t3tools/contracts";

export function resolveSelectedEnvironmentId(
  selectedId: EnvironmentId | null,
  environments: ReadonlyArray<{ readonly environmentId: EnvironmentId }>,
): EnvironmentId | null {
  if (
    selectedId !== null &&
    environments.some((environment) => environment.environmentId === selectedId)
  ) {
    return selectedId;
  }

  return environments[0]?.environmentId ?? null;
}
