import { connectionStatusText } from "@t3tools/client-runtime/connection";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import { AsyncResult } from "effect/unstable/reactivity";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { cn } from "../../lib/cn";
import { copyTextWithHaptic } from "../../lib/copyTextWithHaptic";
import { useThemeColor } from "../../lib/useThemeColor";
import type { ConnectedEnvironmentSummary } from "../../state/remote-runtime-types";
import { ConnectionStatusDot } from "./ConnectionStatusDot";

function connectionStatusLabel(environment: ConnectedEnvironmentSummary): string | null {
  return connectionStatusText({
    phase: environment.connectionState,
    error: environment.connectionError,
    traceId: environment.connectionErrorTraceId,
  });
}

export function ConnectionEnvironmentDetails(props: {
  readonly environment: ConnectedEnvironmentSummary;
  readonly onReconnect: (environmentId: EnvironmentId) => void;
  readonly onRemove: (environmentId: EnvironmentId) => void;
  readonly onUpdate: (
    environmentId: EnvironmentId,
    updates: { readonly label: string; readonly displayUrl: string },
  ) => Promise<AtomCommandResult<unknown, unknown>>;
}) {
  const [label, setLabel] = useState(props.environment.environmentLabel);
  const [url, setUrl] = useState(props.environment.displayUrl);
  const mutedColor = useThemeColor("--color-icon-subtle");
  const primaryFg = useThemeColor("--color-primary-foreground");
  const dangerFg = useThemeColor("--color-danger-foreground");
  const statusLabel = connectionStatusLabel(props.environment);
  const statusTraceId = props.environment.connectionErrorTraceId;
  const hasConnectionFailure = props.environment.connectionError !== null;
  const isRetrying =
    props.environment.connectionState === "connecting" ||
    props.environment.connectionState === "reconnecting";

  const handleSave = useCallback(async () => {
    const result = await props.onUpdate(props.environment.environmentId, {
      label: label.trim(),
      displayUrl: url.trim(),
    });
    if (AsyncResult.isSuccess(result)) return;

    const error = Cause.squash(result.cause);
    Alert.alert(
      "Could not update environment",
      error instanceof Error ? error.message : "The environment could not be updated.",
    );
  }, [label, props, url]);

  return (
    <View className="gap-3 bg-card p-4">
      <View className="flex-row items-start gap-3 border-b border-border pb-4">
        <View className="pt-1.5">
          <ConnectionStatusDot
            state={props.environment.connectionState}
            pulse={isRetrying}
            size={8}
          />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-lg font-t3-bold text-foreground">
            {props.environment.environmentLabel}
          </Text>
          <Text className="text-sm text-foreground-muted" selectable>
            {props.environment.displayUrl}
          </Text>
          <Text
            className={cn(
              "text-sm",
              hasConnectionFailure ? "text-rose-500 dark:text-rose-400" : "text-foreground-muted",
            )}
          >
            {statusLabel ?? "Connected"}
            {statusTraceId ? (
              <>
                {" Trace ID: "}
                <Text
                  accessibilityHint="Copies the trace ID"
                  accessibilityRole="button"
                  className="underline decoration-dotted"
                  onLongPress={() =>
                    copyTextWithHaptic(statusTraceId, { target: "connection-trace-id" })
                  }
                >
                  {statusTraceId}
                </Text>
              </>
            ) : null}
          </Text>
        </View>
      </View>

      {props.environment.isRelayManaged ? (
        <Text className="text-sm text-foreground-muted">
          Managed by T3 Connect. Tunnel details update automatically.
        </Text>
      ) : (
        <>
          <View className="gap-1.5">
            <Text className="text-2xs font-t3-bold tracking-[0.8px] uppercase text-foreground-muted">
              Name
            </Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="My MacBook"
              value={label}
              onChangeText={setLabel}
              className="rounded-[14px] border border-input-border bg-input px-4 py-3 text-base text-foreground"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-2xs font-t3-bold tracking-[0.8px] uppercase text-foreground-muted">
              URL
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="192.168.1.100:8080"
              value={url}
              onChangeText={setUrl}
              className="rounded-[14px] border border-input-border bg-input px-4 py-3 text-base text-foreground"
            />
          </View>
        </>
      )}

      <View className="flex-row justify-end gap-2">
        {props.environment.isRelayManaged ? null : (
          <Pressable
            accessibilityLabel="Save environment"
            accessibilityRole="button"
            className="min-h-[42px] flex-1 flex-row items-center justify-center gap-1.5 rounded-[14px] bg-primary px-3.5 py-2.5 active:opacity-70"
            onPress={() => void handleSave()}
          >
            <SymbolView name="checkmark" size={13} tintColor={primaryFg} type="monochrome" />
            <Text className="text-xs font-t3-bold tracking-[0.8px] uppercase text-primary-foreground">
              Save
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityLabel={`Reconnect ${props.environment.environmentLabel}`}
          accessibilityRole="button"
          className="h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-input-border bg-input active:opacity-70"
          onPress={() => props.onReconnect(props.environment.environmentId)}
        >
          <SymbolView name="arrow.clockwise" size={14} tintColor={mutedColor} type="monochrome" />
        </Pressable>

        <Pressable
          accessibilityLabel={`Remove ${props.environment.environmentLabel}`}
          accessibilityRole="button"
          className="h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-danger-border bg-danger active:opacity-70"
          onPress={() => props.onRemove(props.environment.environmentId)}
        >
          <SymbolView name="trash" size={14} tintColor={dangerFg} type="monochrome" />
        </Pressable>
      </View>
    </View>
  );
}
