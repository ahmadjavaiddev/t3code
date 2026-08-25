import type { MenuAction } from "@react-native-menu/menu";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { ControlPillMenu } from "../../components/ControlPill";
import { useThemeColor } from "../../lib/useThemeColor";
import type { ConnectedEnvironmentSummary } from "../../state/remote-runtime-types";
import { ConnectionAccessContent } from "./ConnectionAccessRouteScreen";
import { ConnectionEnvironmentDetails } from "./ConnectionEnvironmentRow";
import { ConnectionStatusDot } from "./ConnectionStatusDot";
import { resolveSelectedEnvironmentId } from "./environmentSelection";

export function EnvironmentManager(props: {
  readonly environments: ReadonlyArray<ConnectedEnvironmentSummary>;
  readonly managementPairingRoute: "ConnectionsNew" | "SettingsEnvironmentNew";
  readonly onReconnect: (environmentId: EnvironmentId) => void;
  readonly onRemove: (environmentId: EnvironmentId) => void;
  readonly onUpdate: (
    environmentId: EnvironmentId,
    updates: { readonly label: string; readonly displayUrl: string },
  ) => Promise<AtomCommandResult<unknown, unknown>>;
}) {
  const [requestedEnvironmentId, setRequestedEnvironmentId] = useState<EnvironmentId | null>(null);
  const selectedEnvironmentId = resolveSelectedEnvironmentId(
    requestedEnvironmentId,
    props.environments,
  );
  const selectedEnvironment =
    props.environments.find((environment) => environment.environmentId === selectedEnvironmentId) ??
    null;

  if (selectedEnvironment === null) return null;

  return (
    <View collapsable={false} className="gap-6">
      <EnvironmentSelector
        environments={props.environments}
        selectedEnvironmentId={selectedEnvironment.environmentId}
        onSelect={setRequestedEnvironmentId}
      />

      <View collapsable={false} className="overflow-hidden rounded-[24px] bg-card">
        <ConnectionEnvironmentDetails
          key={selectedEnvironment.environmentId}
          environment={selectedEnvironment}
          onReconnect={props.onReconnect}
          onRemove={props.onRemove}
          onUpdate={props.onUpdate}
        />
      </View>

      <ConnectionAccessContent
        key={`access:${selectedEnvironment.environmentId}`}
        environmentId={selectedEnvironment.environmentId}
        managementPairingRoute={props.managementPairingRoute}
      />
    </View>
  );
}

function EnvironmentSelector(props: {
  readonly environments: ReadonlyArray<ConnectedEnvironmentSummary>;
  readonly selectedEnvironmentId: EnvironmentId;
  readonly onSelect: (environmentId: EnvironmentId) => void;
}) {
  const iconColor = useThemeColor("--color-icon-muted");
  const selectedEnvironment = props.environments.find(
    (environment) => environment.environmentId === props.selectedEnvironmentId,
  );
  const actions = useMemo<MenuAction[]>(
    () =>
      props.environments.map((environment) => ({
        id: environment.environmentId,
        title: environment.environmentLabel,
        subtitle: environment.displayUrl,
        state: environment.environmentId === props.selectedEnvironmentId ? "on" : "off",
      })),
    [props.environments, props.selectedEnvironmentId],
  );

  if (!selectedEnvironment) return null;

  return (
    <View className="gap-1.5">
      <Text className="px-1 text-2xs font-t3-bold tracking-[0.8px] uppercase text-foreground-muted">
        Device
      </Text>
      <ControlPillMenu
        actions={actions}
        title="Select device"
        onPressAction={({ nativeEvent }) => props.onSelect(nativeEvent.event as EnvironmentId)}
      >
        <Pressable
          accessibilityLabel={`Selected device: ${selectedEnvironment.environmentLabel}`}
          accessibilityRole="button"
          className="min-h-[64px] flex-row items-center gap-3 rounded-[18px] border border-input-border bg-input px-4 py-3 active:opacity-70"
        >
          <ConnectionStatusDot
            state={selectedEnvironment.connectionState}
            pulse={
              selectedEnvironment.connectionState === "connecting" ||
              selectedEnvironment.connectionState === "reconnecting"
            }
            size={8}
          />
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-base font-t3-bold text-foreground" numberOfLines={1}>
              {selectedEnvironment.environmentLabel}
            </Text>
            <Text className="text-xs text-foreground-muted" numberOfLines={1}>
              {selectedEnvironment.displayUrl}
            </Text>
          </View>
          <SymbolView name="chevron.down" size={12} tintColor={iconColor} type="monochrome" />
        </Pressable>
      </ControlPillMenu>
    </View>
  );
}
