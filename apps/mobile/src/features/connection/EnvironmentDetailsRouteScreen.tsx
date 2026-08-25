import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import type { EnvironmentId } from "@t3tools/contracts";
import { useCallback } from "react";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useRemoteConnections } from "../../state/use-remote-environment-registry";
import {
  applyShowcaseLocalEnvironmentDisplayUrls,
  resolveShowcaseEnvironmentUpdateDisplayUrl,
} from "../showcase/showcaseEnvironmentRows";
import { EnvironmentDetails } from "./EnvironmentDetails";

const SHOWCASE_ENABLED = process.env.EXPO_PUBLIC_SHOWCASE === "1";

type EnvironmentDetailsRouteParams = {
  readonly environmentId: string;
};

type EnvironmentDetailsRouteProps = StaticScreenProps<EnvironmentDetailsRouteParams>;

export function SettingsEnvironmentDetailsRouteScreen({ route }: EnvironmentDetailsRouteProps) {
  return (
    <EnvironmentDetailsRouteScreen
      environmentId={route.params.environmentId}
      managementPairingRoute="SettingsEnvironmentNew"
      showcase={SHOWCASE_ENABLED}
    />
  );
}

export function RootEnvironmentDetailsRouteScreen({ route }: EnvironmentDetailsRouteProps) {
  return (
    <EnvironmentDetailsRouteScreen
      environmentId={route.params.environmentId}
      managementPairingRoute="ConnectionsNew"
      showcase={false}
    />
  );
}

function EnvironmentDetailsRouteScreen(props: {
  readonly environmentId: string;
  readonly managementPairingRoute: "ConnectionsNew" | "SettingsEnvironmentNew";
  readonly showcase: boolean;
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    connectedEnvironments,
    onReconnectEnvironment,
    onRemoveEnvironmentPress,
    onUpdateEnvironment,
  } = useRemoteConnections();
  const actualEnvironment = connectedEnvironments.find(
    (environment) => environment.environmentId === props.environmentId,
  );
  const environment = actualEnvironment
    ? props.showcase
      ? applyShowcaseLocalEnvironmentDisplayUrls([actualEnvironment])[0]
      : actualEnvironment
    : undefined;

  const handleUpdateEnvironment = useCallback(
    (
      environmentId: EnvironmentId,
      updates: { readonly label: string; readonly displayUrl: string },
    ) => {
      if (!props.showcase || !actualEnvironment || !environment) {
        return onUpdateEnvironment(environmentId, updates);
      }
      return onUpdateEnvironment(environmentId, {
        ...updates,
        displayUrl: resolveShowcaseEnvironmentUpdateDisplayUrl({
          actualDisplayUrl: actualEnvironment.displayUrl,
          presentedDisplayUrl: environment.displayUrl,
          submittedDisplayUrl: updates.displayUrl,
        }),
      });
    },
    [actualEnvironment, environment, onUpdateEnvironment, props.showcase],
  );
  const title = environment?.environmentLabel ?? "Environment Details";

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <>
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader title={title} onBack={() => navigation.goBack()} />
        </>
      ) : (
        <NativeStackScreenOptions options={{ title }} />
      )}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 18,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
      >
        {environment ? (
          <EnvironmentDetails
            environment={environment}
            managementPairingRoute={props.managementPairingRoute}
            onReconnect={onReconnectEnvironment}
            onRemove={onRemoveEnvironmentPress}
            onUpdate={handleUpdateEnvironment}
          />
        ) : (
          <View className="rounded-[24px] bg-card px-6 py-8">
            <Text className="text-center text-sm leading-normal text-foreground-muted">
              This environment is no longer available.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
