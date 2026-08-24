import type { AuthCreatePairingCredentialInput, AuthSessionId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import type { PreparedConnection } from "../connection/model.ts";
import { environmentEndpointUrl } from "../environment/endpoint.ts";
import { ManagedRelayDpopSigner } from "../relay/managedRelay.ts";
import { executeEnvironmentHttpRequest, makeEnvironmentHttpApiClient } from "../rpc/http.ts";
import { buildEnvironmentAuthHeaders, withEnvironmentCredentials } from "./environmentHttpAuth.ts";

const DEFAULT_AUTH_ACCESS_TIMEOUT_MS = 6_000;

interface AuthAccessRequestContext {
  readonly prepared: PreparedConnection;
  readonly timeoutMs?: number;
}

export const createEnvironmentPairingCredential = Effect.fn(
  "clientRuntime.state.createEnvironmentPairingCredential",
)(function* (
  input: AuthAccessRequestContext & {
    readonly credential: AuthCreatePairingCredentialInput;
  },
) {
  const requestUrl = environmentEndpointUrl(input.prepared.httpBaseUrl, "/api/auth/pairing-token");
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_AUTH_ACCESS_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.auth.pairingCredential({ headers, payload: input.credential }),
    ),
  );
});

export const revokeEnvironmentPairingLink = Effect.fn(
  "clientRuntime.state.revokeEnvironmentPairingLink",
)(function* (input: AuthAccessRequestContext & { readonly id: string }) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/auth/pairing-links/revoke",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_AUTH_ACCESS_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.auth.revokePairingLink({ headers, payload: { id: input.id } }),
    ),
  );
});

export const revokeEnvironmentClientSession = Effect.fn(
  "clientRuntime.state.revokeEnvironmentClientSession",
)(function* (input: AuthAccessRequestContext & { readonly sessionId: AuthSessionId }) {
  const requestUrl = environmentEndpointUrl(input.prepared.httpBaseUrl, "/api/auth/clients/revoke");
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_AUTH_ACCESS_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.auth.revokeClient({ headers, payload: { sessionId: input.sessionId } }),
    ),
  );
});

export const revokeOtherEnvironmentClientSessions = Effect.fn(
  "clientRuntime.state.revokeOtherEnvironmentClientSessions",
)(function* (input: AuthAccessRequestContext) {
  const requestUrl = environmentEndpointUrl(
    input.prepared.httpBaseUrl,
    "/api/auth/clients/revoke-others",
  );
  const client = yield* makeEnvironmentHttpApiClient(input.prepared.httpBaseUrl);
  const signer = yield* Effect.serviceOption(ManagedRelayDpopSigner);
  const headers = yield* buildEnvironmentAuthHeaders(
    input.prepared.httpAuthorization,
    "POST",
    requestUrl,
    signer,
  );
  return yield* executeEnvironmentHttpRequest(
    requestUrl,
    input.timeoutMs ?? DEFAULT_AUTH_ACCESS_TIMEOUT_MS,
    withEnvironmentCredentials(
      input.prepared.httpAuthorization,
      client.auth.revokeOtherClients({ headers }),
    ),
  );
});
