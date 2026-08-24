import { AuthSessionId, EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { BearerConnectionTarget, type PreparedConnection } from "../connection/model.ts";
import { remoteHttpClientLayer } from "../rpc/http.ts";
import {
  createEnvironmentPairingCredential,
  revokeEnvironmentClientSession,
  revokeEnvironmentPairingLink,
  revokeOtherEnvironmentClientSessions,
} from "./authAccessHttp.ts";

const TARGET = new BearerConnectionTarget({
  environmentId: EnvironmentId.make("environment-1"),
  label: "Test environment",
  connectionId: "bearer:environment-1",
});

const PREPARED: PreparedConnection = {
  environmentId: TARGET.environmentId,
  label: TARGET.label,
  httpBaseUrl: "https://environment.example.test/base",
  socketUrl: "wss://environment.example.test/ws",
  httpAuthorization: { _tag: "Bearer", token: "session-token" },
  target: TARGET,
};

function requestBody(init: RequestInit): unknown {
  const body =
    typeof init.body === "string"
      ? init.body
      : init.body instanceof Uint8Array
        ? new TextDecoder().decode(init.body)
        : "";
  return body.length > 0 ? JSON.parse(body) : null;
}

describe("environment auth access HTTP", () => {
  it.effect("creates and revokes access records with the prepared bearer credential", () =>
    Effect.gen(function* () {
      const calls: Array<readonly [RequestInfo | URL, RequestInit]> = [];
      const fetchFn = ((request, init) => {
        const requestInit = init ?? {};
        calls.push([request, requestInit]);
        const pathname = new URL(String(request)).pathname;
        if (pathname === "/api/auth/pairing-token") {
          return Promise.resolve(
            Response.json({
              id: "pairing-link-1",
              credential: "pairing-secret",
              label: "Pixel",
              expiresAt: "2026-08-24T20:00:00.000Z",
            }),
          );
        }
        if (pathname === "/api/auth/clients/revoke-others") {
          return Promise.resolve(Response.json({ revokedCount: 2 }));
        }
        return Promise.resolve(Response.json({ revoked: true }));
      }) satisfies typeof fetch;
      const layer = remoteHttpClientLayer(fetchFn);

      const created = yield* createEnvironmentPairingCredential({
        prepared: PREPARED,
        credential: {
          label: "Pixel",
          scopes: ["orchestration:read", "orchestration:operate"],
        },
      }).pipe(Effect.provide(layer));
      const revokedLink = yield* revokeEnvironmentPairingLink({
        prepared: PREPARED,
        id: "pairing-link-1",
      }).pipe(Effect.provide(layer));
      const revokedClient = yield* revokeEnvironmentClientSession({
        prepared: PREPARED,
        sessionId: AuthSessionId.make("session-2"),
      }).pipe(Effect.provide(layer));
      const revokedOthers = yield* revokeOtherEnvironmentClientSessions({
        prepared: PREPARED,
      }).pipe(Effect.provide(layer));

      expect(created.credential).toBe("pairing-secret");
      expect(revokedLink.revoked).toBe(true);
      expect(revokedClient.revoked).toBe(true);
      expect(revokedOthers.revokedCount).toBe(2);
      expect(calls.map(([request]) => new URL(String(request)).pathname)).toEqual([
        "/api/auth/pairing-token",
        "/api/auth/pairing-links/revoke",
        "/api/auth/clients/revoke",
        "/api/auth/clients/revoke-others",
      ]);
      expect(calls.every(([, init]) => init.method === "POST")).toBe(true);
      expect(
        calls.every(
          ([, init]) => new Headers(init.headers).get("authorization") === "Bearer session-token",
        ),
      ).toBe(true);
      expect(requestBody(calls[0]![1])).toEqual({
        label: "Pixel",
        scopes: ["orchestration:read", "orchestration:operate"],
      });
      expect(requestBody(calls[1]![1])).toEqual({ id: "pairing-link-1" });
      expect(requestBody(calls[2]![1])).toEqual({ sessionId: "session-2" });
      expect(requestBody(calls[3]![1])).toBeNull();
    }),
  );
});
