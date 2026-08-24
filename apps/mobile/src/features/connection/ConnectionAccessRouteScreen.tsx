import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { type AuthClientSession, type AuthPairingLink, EnvironmentId } from "@t3tools/contracts";
import {
  createEnvironmentPairingCredential,
  revokeEnvironmentClientSession,
  revokeEnvironmentPairingLink,
  revokeOtherEnvironmentClientSessions,
} from "@t3tools/client-runtime/state/auth";
import * as Option from "effect/Option";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { ErrorBanner } from "../../components/ErrorBanner";
import { SymbolView } from "../../components/AppSymbol";
import { copyTextWithHaptic } from "../../lib/copyTextWithHaptic";
import { runtime } from "../../lib/runtime";
import { useThemeColor } from "../../lib/useThemeColor";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { authEnvironment } from "../../state/auth";
import { useEnvironmentQuery } from "../../state/query";
import { useSavedRemoteConnection } from "../../state/use-remote-environment-registry";
import { environmentSession, usePreparedConnection } from "../../state/session";
import { SettingsSection } from "../settings/components/SettingsSection";
import { ConnectionSheetButton } from "./ConnectionSheetButton";
import { buildPairingUrl } from "./pairing";
import {
  canReadEnvironmentAccess,
  canWriteEnvironmentAccess,
  clientSessionLabel,
  formatAccessDate,
  pairingScopes,
  sortClientSessions,
  sortPairingLinks,
} from "./connectionAccessModel";

type ConnectionAccessRouteParams = {
  readonly environmentId: string;
};

type MutationKind = "create" | "revoke-others" | `pairing-link:${string}` | `client:${string}`;

export function ConnectionAccessRouteScreen({
  route,
}: StaticScreenProps<ConnectionAccessRouteParams>) {
  const environmentId = EnvironmentId.make(route.params.environmentId);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const connection = useSavedRemoteConnection(environmentId);
  const prepared = Option.getOrNull(usePreparedConnection(environmentId));
  const session = useEnvironmentQuery(environmentSession.sessionStateAtom(environmentId));
  const canRead = canReadEnvironmentAccess(session.data?.scopes);
  const canWrite = canWriteEnvironmentAccess(session.data?.scopes);
  const access = useEnvironmentQuery(
    canRead
      ? authEnvironment.accessChanges({
          environmentId,
          input: null,
        })
      : null,
  );
  const snapshot = access.data?.type === "snapshot" ? access.data.payload : null;
  const pairingLinks = useMemo(
    () => sortPairingLinks(snapshot?.pairingLinks ?? []),
    [snapshot?.pairingLinks],
  );
  const clientSessions = useMemo(
    () => sortClientSessions(snapshot?.clientSessions ?? []),
    [snapshot?.clientSessions],
  );
  const [label, setLabel] = useState("");
  const [grantManagement, setGrantManagement] = useState(false);
  const [mutation, setMutation] = useState<MutationKind | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const iconColor = useThemeColor("--color-icon-muted");
  const dangerIconColor = useThemeColor("--color-danger-foreground");
  const switchTrackColor = useThemeColor("--color-primary");

  const runMutation = useCallback(async <A,>(kind: MutationKind, run: () => Promise<A>) => {
    setMutation(kind);
    setMutationError(null);
    try {
      return await run();
    } catch (error) {
      setMutationError(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "The access-management request failed.",
      );
      return null;
    } finally {
      setMutation(null);
    }
  }, []);

  const pairingUrl = useCallback(
    (credential: string) =>
      buildPairingUrl(prepared?.httpBaseUrl ?? connection?.displayUrl ?? "", credential),
    [connection?.displayUrl, prepared],
  );

  const handleCreate = useCallback(async () => {
    if (!prepared) return;
    const scopes = pairingScopes(grantManagement);
    const result = await runMutation("create", () =>
      runtime.runPromise(
        createEnvironmentPairingCredential({
          prepared,
          credential: {
            ...(label.trim().length > 0 ? { label: label.trim() } : {}),
            scopes,
          },
        }),
      ),
    );
    if (!result) return;
    setLabel("");
    setGrantManagement(false);
    const url = pairingUrl(result.credential);
    Alert.alert("Pairing link created", "Share this one-time link with the device you trust.", [
      {
        text: "Copy",
        onPress: () => copyTextWithHaptic(url, { target: "mobile-pairing-link" }),
      },
      {
        text: "Share",
        onPress: () => {
          void Share.share({ message: url });
        },
      },
      { text: "Done", style: "cancel" },
    ]);
  }, [grantManagement, label, pairingUrl, prepared, runMutation]);

  const confirmRevokePairingLink = useCallback(
    (pairingLink: AuthPairingLink) => {
      if (!prepared) return;
      Alert.alert(
        "Revoke pairing link?",
        `${pairingLink.label ?? "This pairing link"} will stop accepting new clients.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: () => {
              void runMutation(`pairing-link:${pairingLink.id}`, () =>
                runtime.runPromise(revokeEnvironmentPairingLink({ prepared, id: pairingLink.id })),
              );
            },
          },
        ],
      );
    },
    [prepared, runMutation],
  );

  const confirmRevokeClient = useCallback(
    (client: AuthClientSession) => {
      if (!prepared || client.current) return;
      Alert.alert(
        "Revoke client access?",
        `${clientSessionLabel(client)} will need a new pairing link to reconnect.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: () => {
              void runMutation(`client:${client.sessionId}`, () =>
                runtime.runPromise(
                  revokeEnvironmentClientSession({ prepared, sessionId: client.sessionId }),
                ),
              );
            },
          },
        ],
      );
    },
    [prepared, runMutation],
  );

  const confirmRevokeOthers = useCallback(() => {
    if (!prepared) return;
    Alert.alert(
      "Revoke every other client?",
      "All other paired clients will need a new pairing link before reconnecting.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke all",
          style: "destructive",
          onPress: () => {
            void runMutation("revoke-others", () =>
              runtime.runPromise(revokeOtherEnvironmentClientSessions({ prepared })),
            );
          },
        },
      ],
    );
  }, [prepared, runMutation]);

  const openManagementPairing = useCallback(() => {
    navigation.navigate("SettingsSheet", {
      screen: "SettingsContent",
      params: {
        screen: "SettingsEnvironmentNew",
        params: { requestAccessManagement: "1" },
      },
    });
  }, [navigation]);

  const sharePairingLink = useCallback(
    (credential: string) => {
      void Share.share({ message: pairingUrl(credential) });
    },
    [pairingUrl],
  );

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <>
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader title="Connection Access" onBack={() => navigation.goBack()} />
        </>
      ) : (
        <NativeStackScreenOptions
          options={{ title: connection?.environmentLabel ?? "Connection Access" }}
        />
      )}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        {connection === null ? (
          <ErrorBanner message="This environment is no longer saved on this device." />
        ) : session.isPending && session.data === null ? (
          <View className="items-center gap-3 py-10">
            <ActivityIndicator color={iconColor} />
            <Text className="text-sm text-foreground-muted">Checking access…</Text>
          </View>
        ) : session.data === null && session.error ? (
          <View className="gap-4 rounded-[24px] bg-card p-5">
            <View className="gap-2">
              <Text className="text-lg font-t3-bold text-foreground">Could not check access</Text>
              <Text className="text-sm leading-normal text-foreground-muted">
                Reconnect this environment, then retry the permission check.
              </Text>
            </View>
            <ErrorBanner message={session.error} />
            <ConnectionSheetButton
              icon="arrow.clockwise"
              label="Retry"
              onPress={session.refresh}
              tone="secondary"
            />
          </View>
        ) : !canRead ? (
          <View className="gap-4 rounded-[24px] bg-card p-5">
            <View className="gap-2">
              <Text className="text-lg font-t3-bold text-foreground">
                Management access required
              </Text>
              <Text className="text-sm leading-normal text-foreground-muted">
                This mobile session can use the environment, but it cannot inspect or revoke other
                clients. Pair again with an owner link and enable connection management.
              </Text>
            </View>
            {session.error ? <ErrorBanner message={session.error} /> : null}
            <ConnectionSheetButton
              icon="link"
              label="Pair for management"
              onPress={openManagementPairing}
              tone="primary"
            />
          </View>
        ) : (
          <>
            {mutationError || access.error ? (
              <ErrorBanner message={mutationError ?? access.error ?? "Request failed."} />
            ) : null}

            {canWrite ? (
              <SettingsSection title="Create pairing link" card>
                <View className="gap-4 p-4">
                  <View className="gap-1.5">
                    <Text className="text-2xs font-t3-bold tracking-[0.8px] uppercase text-foreground-muted">
                      Device label (optional)
                    </Text>
                    <TextInput
                      autoCapitalize="words"
                      autoCorrect={false}
                      placeholder="My tablet"
                      value={label}
                      onChangeText={setLabel}
                      className="rounded-[14px] border border-input-border bg-input px-4 py-3 text-base text-foreground"
                    />
                  </View>
                  <View className="flex-row items-center gap-3">
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="text-sm font-t3-bold text-foreground">
                        Connection management
                      </Text>
                      <Text className="text-xs leading-normal text-foreground-muted">
                        Let the new client create links and revoke access.
                      </Text>
                    </View>
                    <Switch
                      accessibilityLabel="Grant connection management"
                      value={grantManagement}
                      onValueChange={setGrantManagement}
                      trackColor={{ true: switchTrackColor }}
                    />
                  </View>
                  <ConnectionSheetButton
                    icon="plus"
                    label={mutation === "create" ? "Creating…" : "Create link"}
                    disabled={mutation !== null || prepared === null}
                    onPress={() => void handleCreate()}
                    tone="primary"
                  />
                </View>
              </SettingsSection>
            ) : null}

            <SettingsSection title="Active pairing links" card>
              {access.isPending && snapshot === null ? (
                <View className="items-center py-8">
                  <ActivityIndicator color={iconColor} />
                </View>
              ) : pairingLinks.length === 0 ? (
                <Text className="px-4 py-5 text-sm text-foreground-muted">
                  No active pairing links.
                </Text>
              ) : (
                pairingLinks.map((pairingLink, index) => (
                  <View
                    key={pairingLink.id}
                    className={index === 0 ? "gap-3 p-4" : "gap-3 border-t border-border p-4"}
                  >
                    <View className="gap-0.5">
                      <Text className="text-base font-t3-bold text-foreground">
                        {pairingLink.label ?? "Pairing link"}
                      </Text>
                      <Text className="text-xs text-foreground-muted">
                        Expires {formatAccessDate(pairingLink.expiresAt)} ·{" "}
                        {pairingLink.scopes.length} permissions
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <AccessAction
                        icon="doc.on.doc"
                        label="Copy"
                        onPress={() =>
                          copyTextWithHaptic(pairingUrl(pairingLink.credential), {
                            target: "mobile-pairing-link",
                          })
                        }
                      />
                      <AccessAction
                        icon="arrow.up"
                        label="Share"
                        onPress={() => sharePairingLink(pairingLink.credential)}
                      />
                      {canWrite ? (
                        <AccessAction
                          danger
                          disabled={mutation !== null || prepared === null}
                          icon="trash"
                          label="Revoke"
                          onPress={() => confirmRevokePairingLink(pairingLink)}
                        />
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </SettingsSection>

            <SettingsSection title="Authorized clients" card>
              {clientSessions.length === 0 ? (
                <Text className="px-4 py-5 text-sm text-foreground-muted">
                  No authorized clients found.
                </Text>
              ) : (
                clientSessions.map((client, index) => (
                  <View
                    key={client.sessionId}
                    className={
                      index === 0
                        ? "flex-row items-center gap-3 p-4"
                        : "flex-row items-center gap-3 border-t border-border p-4"
                    }
                  >
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="text-base font-t3-bold text-foreground" numberOfLines={1}>
                        {clientSessionLabel(client)}
                      </Text>
                      <Text className="text-xs text-foreground-muted">
                        {client.current
                          ? "This device"
                          : client.connected
                            ? "Connected"
                            : "Offline"}
                        {client.lastConnectedAt
                          ? ` · ${formatAccessDate(client.lastConnectedAt)}`
                          : ""}
                      </Text>
                    </View>
                    {canWrite && !client.current ? (
                      <Pressable
                        accessibilityLabel={`Revoke ${clientSessionLabel(client)}`}
                        accessibilityRole="button"
                        disabled={mutation !== null || prepared === null}
                        className="h-10 w-10 items-center justify-center rounded-[13px] border border-danger-border bg-danger disabled:opacity-50"
                        onPress={() => confirmRevokeClient(client)}
                      >
                        <SymbolView
                          name="trash"
                          size={14}
                          tintColor={dangerIconColor}
                          type="monochrome"
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </SettingsSection>

            {canWrite && clientSessions.some((client) => !client.current) ? (
              <ConnectionSheetButton
                icon="trash"
                label={mutation === "revoke-others" ? "Revoking…" : "Revoke other clients"}
                disabled={mutation !== null || prepared === null}
                onPress={confirmRevokeOthers}
                tone="danger"
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function AccessAction(props: {
  readonly icon: React.ComponentProps<typeof SymbolView>["name"];
  readonly label: string;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const tintColor = useThemeColor(
    props.danger ? "--color-danger-foreground" : "--color-secondary-foreground",
  );
  return (
    <Pressable
      accessibilityLabel={props.label}
      accessibilityRole="button"
      disabled={props.disabled}
      className={
        props.danger
          ? "min-h-[40px] flex-1 flex-row items-center justify-center gap-1.5 rounded-[13px] border border-danger-border bg-danger px-2 disabled:opacity-50"
          : "min-h-[40px] flex-1 flex-row items-center justify-center gap-1.5 rounded-[13px] border border-border bg-secondary px-2 disabled:opacity-50"
      }
      onPress={props.onPress}
    >
      <SymbolView name={props.icon} size={13} tintColor={tintColor} type="monochrome" />
      <Text
        className={
          props.danger
            ? "text-xs font-t3-bold text-danger-foreground"
            : "text-xs font-t3-bold text-secondary-foreground"
        }
      >
        {props.label}
      </Text>
    </Pressable>
  );
}
