import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { EnvironmentId } from "@t3tools/contracts";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { ConnectionEnvironmentRow } from "../connection/ConnectionEnvironmentRow";
import { ConnectionAccessContent } from "../connection/ConnectionAccessRouteScreen";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useRemoteConnections } from "../../state/use-remote-environment-registry";

type SettingsEnvironmentDetailsRouteParams = {
  readonly environmentId: string;
};

export function SettingsEnvironmentDetailsRouteScreen({
  route,
}: StaticScreenProps<SettingsEnvironmentDetailsRouteParams>) {
  return (
    <EnvironmentDetailsRouteContent
      environmentId={route.params.environmentId}
      managementPairingRoute="SettingsEnvironmentNew"
    />
  );
}

export function ConnectionDetailsRouteScreen({
  route,
}: StaticScreenProps<SettingsEnvironmentDetailsRouteParams>) {
  return (
    <EnvironmentDetailsRouteContent
      environmentId={route.params.environmentId}
      managementPairingRoute="ConnectionsNew"
    />
  );
}

function EnvironmentDetailsRouteContent(props: {
  readonly environmentId: string;
  readonly managementPairingRoute: "ConnectionsNew" | "SettingsEnvironmentNew";
}) {
  const environmentId = EnvironmentId.make(props.environmentId);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    connectedEnvironments,
    onReconnectEnvironment,
    onRemoveEnvironmentPress,
    onUpdateEnvironment,
  } = useRemoteConnections();
  const environment = connectedEnvironments.find((item) => item.environmentId === environmentId);

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <>
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader
            title={environment?.environmentLabel ?? "Environment Details"}
            onBack={() => navigation.goBack()}
          />
        </>
      ) : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          gap: 24,
          paddingBottom: Math.max(insets.bottom, 18) + 18,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
      >
        {environment ? (
          <View collapsable={false} className="overflow-hidden rounded-[24px] bg-card">
            <ConnectionEnvironmentRow
              environment={environment}
              expanded
              detailsOnly
              onReconnect={onReconnectEnvironment}
              onRemove={onRemoveEnvironmentPress}
              onUpdate={onUpdateEnvironment}
            />
          </View>
        ) : (
          <View className="rounded-[24px] bg-card px-6 py-8">
            <Text className="text-center text-sm text-foreground-muted">
              This environment is no longer available.
            </Text>
          </View>
        )}
        {environment ? (
          <View className="gap-3">
            <Text className="px-1 text-lg font-t3-bold text-foreground">Client access</Text>
            <ConnectionAccessContent
              embedded
              environmentId={environment.environmentId}
              managementPairingRoute={props.managementPairingRoute}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
