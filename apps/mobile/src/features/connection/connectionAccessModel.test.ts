import {
  AuthAccessReadScope,
  AuthAccessWriteScope,
  AuthClientSession,
  AuthPairingLink,
  AuthSessionId,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import {
  canReadEnvironmentAccess,
  canWriteEnvironmentAccess,
  clientSessionLabel,
  pairingScopes,
  sortClientSessions,
  sortPairingLinks,
} from "./connectionAccessModel";

function pairingLink(id: string, createdAt: string) {
  return AuthPairingLink.make({
    id,
    credential: `credential-${id}`,
    scopes: ["orchestration:read"],
    subject: "subject",
    createdAt: Option.getOrThrow(DateTime.make(createdAt)),
    expiresAt: Option.getOrThrow(DateTime.make("2026-09-01T00:00:00Z")),
  });
}

function clientSession(input: {
  readonly id: string;
  readonly current?: boolean;
  readonly connected?: boolean;
  readonly label?: string;
  readonly issuedAt?: string;
}) {
  return AuthClientSession.make({
    sessionId: AuthSessionId.make(input.id),
    subject: "subject",
    scopes: ["orchestration:read"],
    method: "bearer-access-token",
    client: {
      deviceType: "mobile",
      ...(input.label ? { label: input.label } : {}),
    },
    issuedAt: Option.getOrThrow(DateTime.make(input.issuedAt ?? "2026-08-20T00:00:00Z")),
    expiresAt: Option.getOrThrow(DateTime.make("2026-09-20T00:00:00Z")),
    lastConnectedAt: null,
    connected: input.connected ?? false,
    current: input.current ?? false,
  });
}

describe("connection access model", () => {
  it("adds access management scopes only when requested", () => {
    expect(pairingScopes(false)).not.toContain(AuthAccessReadScope);
    expect(pairingScopes(false)).not.toContain(AuthAccessWriteScope);
    expect(pairingScopes(true)).toContain(AuthAccessReadScope);
    expect(pairingScopes(true)).toContain(AuthAccessWriteScope);
    expect(canReadEnvironmentAccess(pairingScopes(true))).toBe(true);
    expect(canWriteEnvironmentAccess(pairingScopes(true))).toBe(true);
  });

  it("orders current and connected clients before older inactive clients", () => {
    const values = sortClientSessions([
      clientSession({ id: "old", issuedAt: "2026-08-01T00:00:00Z" }),
      clientSession({ id: "connected", connected: true }),
      clientSession({ id: "current", current: true, label: "This Pixel" }),
    ]);

    expect(values.map((value) => value.sessionId)).toEqual(["current", "connected", "old"]);
    expect(clientSessionLabel(values[0]!)).toBe("This Pixel");
  });

  it("orders newest pairing links first", () => {
    expect(
      sortPairingLinks([
        pairingLink("older", "2026-08-20T00:00:00Z"),
        pairingLink("newer", "2026-08-21T00:00:00Z"),
      ]).map((value) => value.id),
    ).toEqual(["newer", "older"]);
  });
});
