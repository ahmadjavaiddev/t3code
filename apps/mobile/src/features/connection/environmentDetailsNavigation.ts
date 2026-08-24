export function environmentDetailsRoute(environmentId: string) {
  return {
    name: "ConnectionDetails",
    params: { environmentId },
  } as const;
}
