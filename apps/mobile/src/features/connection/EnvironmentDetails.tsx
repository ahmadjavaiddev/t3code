import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId } from "@t3tools/contracts";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../../components/AppText";
import type { ConnectedEnvironmentSummary } from "../../state/remote-runtime-types";
import { ConnectionAccessContent } from "./ConnectionAccessRouteScreen";
import { ConnectionEnvironmentDetails } from "./ConnectionEnvironmentRow";

export function EnvironmentDetails(props: {
  readonly environment: ConnectedEnvironmentSummary;
  readonly managementPairingRoute: "ConnectionsNew" | "SettingsEnvironmentNew";
  readonly onReconnect: (environmentId: EnvironmentId) => void;
  readonly onRemove: (environmentId: EnvironmentId) => void;
  readonly onUpdate: (
    environmentId: EnvironmentId,
    updates: { readonly label: string; readonly displayUrl: string },
  ) => Promise<AtomCommandResult<unknown, unknown>>;
}) {
  return (
    <View collapsable={false} className="gap-6">
      <View collapsable={false} className="overflow-hidden rounded-[24px] bg-card">
        <ConnectionEnvironmentDetails
          key={props.environment.environmentId}
          environment={props.environment}
          onReconnect={props.onReconnect}
          onRemove={props.onRemove}
          onUpdate={props.onUpdate}
        />
      </View>

      <ConnectionAccessErrorBoundary key={props.environment.environmentId}>
        <ConnectionAccessContent
          environmentId={props.environment.environmentId}
          managementPairingRoute={props.managementPairingRoute}
        />
      </ConnectionAccessErrorBoundary>
    </View>
  );
}

class ConnectionAccessErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[connection-access] render failed", error, info.componentStack);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View className="gap-4 rounded-[24px] bg-card p-5">
        <View className="gap-2">
          <Text className="text-lg font-t3-bold text-foreground">
            Could not show connection access
          </Text>
          <Text className="text-sm leading-normal text-foreground-muted">
            The environment details are still available. Retry loading its pairing links and
            authorized clients.
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Retry connection access"
          accessibilityRole="button"
          className="min-h-[48px] items-center justify-center rounded-[16px] bg-primary px-4 py-3 active:opacity-70"
          onPress={this.retry}
        >
          <Text className="text-xs font-t3-bold tracking-[0.8px] uppercase text-primary-foreground">
            Retry
          </Text>
        </Pressable>
      </View>
    );
  }
}
