import {
  AuthAccessReadScope,
  AuthAccessWriteScope,
  AuthStandardClientScopes,
  type AuthClientSession,
  type AuthEnvironmentScope,
  type AuthPairingLink,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

export const MobileAccessManagementScopes = [
  ...AuthStandardClientScopes,
  AuthAccessReadScope,
  AuthAccessWriteScope,
] as const satisfies ReadonlyArray<AuthEnvironmentScope>;

export function pairingScopes(manageAccess: boolean): ReadonlyArray<AuthEnvironmentScope> {
  return manageAccess ? MobileAccessManagementScopes : AuthStandardClientScopes;
}

export function canReadEnvironmentAccess(
  scopes: ReadonlyArray<AuthEnvironmentScope> | null | undefined,
): boolean {
  return scopes?.includes(AuthAccessReadScope) ?? false;
}

export function canWriteEnvironmentAccess(
  scopes: ReadonlyArray<AuthEnvironmentScope> | null | undefined,
): boolean {
  return scopes?.includes(AuthAccessWriteScope) ?? false;
}

export function sortPairingLinks(
  pairingLinks: ReadonlyArray<AuthPairingLink>,
): ReadonlyArray<AuthPairingLink> {
  // Hermes does not ship the ES2023 change-by-copy array methods.
  return [...pairingLinks].sort(
    (left, right) => right.createdAt.epochMilliseconds - left.createdAt.epochMilliseconds,
  );
}

export function sortClientSessions(
  clientSessions: ReadonlyArray<AuthClientSession>,
): ReadonlyArray<AuthClientSession> {
  return [...clientSessions].sort((left, right) => {
    if (left.current !== right.current) return left.current ? -1 : 1;
    if (left.connected !== right.connected) return left.connected ? -1 : 1;
    return right.issuedAt.epochMilliseconds - left.issuedAt.epochMilliseconds;
  });
}

export function clientSessionLabel(session: AuthClientSession): string {
  return (
    session.client.label ??
    session.client.browser ??
    session.client.os ??
    (session.client.deviceType === "mobile" ? "Mobile client" : "T3 Code client")
  );
}

export function formatAccessDate(value: DateTime.DateTime): string {
  return DateTime.toDate(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
