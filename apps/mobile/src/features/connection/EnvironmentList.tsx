import { connectionStatusText } from "@t3tools/client-runtime/connection";
import type { EnvironmentId } from "@t3tools/contracts";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { cn } from "../../lib/cn";
import { useThemeColor } from "../../lib/useThemeColor";
import type { ConnectedEnvironmentSummary } from "../../state/remote-runtime-types";
import { ConnectionStatusDot } from "./ConnectionStatusDot";

export function EnvironmentList(props: {
  readonly environments: ReadonlyArray<ConnectedEnvironmentSummary>;
  readonly onSelect: (environmentId: EnvironmentId) => void;
}) {
  const iconColor = useThemeColor("--color-icon-muted");

  return (
    <View collapsable={false} className="overflow-hidden rounded-[24px] bg-card">
      {props.environments.map((environment, index) => {
        const status = connectionStatusText({
          phase: environment.connectionState,
          error: environment.connectionError,
          traceId: environment.connectionErrorTraceId,
        });
        const isRetrying =
          environment.connectionState === "connecting" ||
          environment.connectionState === "reconnecting";

        return (
          <Pressable
            key={environment.environmentId}
            accessibilityHint="Opens environment details and access settings"
            accessibilityLabel={`Open ${environment.environmentLabel}`}
            accessibilityRole="button"
            className={cn(
              "min-h-[72px] flex-row items-center gap-3 px-4 py-3.5 active:opacity-70",
              index !== 0 && "border-t border-border",
            )}
            onPress={() => props.onSelect(environment.environmentId)}
          >
            <ConnectionStatusDot state={environment.connectionState} pulse={isRetrying} size={8} />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-base font-t3-bold text-foreground" numberOfLines={1}>
                {environment.environmentLabel}
              </Text>
              <Text className="text-xs text-foreground-muted" numberOfLines={1}>
                {environment.displayUrl}
              </Text>
              <Text
                className={cn(
                  "text-xs",
                  environment.connectionError
                    ? "text-rose-500 dark:text-rose-400"
                    : "text-foreground-muted",
                )}
                numberOfLines={1}
              >
                {status ?? "Connected"}
              </Text>
            </View>
            <SymbolView name="chevron.right" size={12} tintColor={iconColor} type="monochrome" />
          </Pressable>
        );
      })}
    </View>
  );
}
