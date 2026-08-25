import { NativeHeaderToolbar, NativeStackScreenOptions } from "../../native/StackHeader";
import { StackActions, useNavigation } from "@react-navigation/native";
import { SymbolView } from "../../components/AppSymbol";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../../components/AppText";
import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { CloudEnvironmentRows } from "../connection/CloudEnvironmentRows";
import { EnvironmentList } from "../connection/EnvironmentList";
import { splitEnvironmentSections } from "../connection/environmentSections";
import { useThemeColor } from "../../lib/useThemeColor";
import { useRemoteConnections } from "../../state/use-remote-environment-registry";
import {
  applyShowcaseLocalEnvironmentDisplayUrls,
  SHOWCASE_AVAILABLE_CLOUD_ENVIRONMENTS,
  SHOWCASE_CONNECTED_CLOUD_ENVIRONMENTS,
} from "../showcase/showcaseEnvironmentRows";

const SHOWCASE_ENABLED = process.env.EXPO_PUBLIC_SHOWCASE === "1";

export function SettingsEnvironmentsRouteScreen() {
  const { connectedEnvironments, onReconnectEnvironment } = useRemoteConnections();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const environmentSections = splitEnvironmentSections({
    connectedEnvironments,
    cloudEnvironments: null,
  });
  const localEnvironments = SHOWCASE_ENABLED
    ? applyShowcaseLocalEnvironmentDisplayUrls(environmentSections.localEnvironments)
    : environmentSections.localEnvironments;
  const managedEnvironments = SHOWCASE_ENABLED ? localEnvironments : connectedEnvironments;
  const connectedCloudEnvironments = SHOWCASE_ENABLED ? SHOWCASE_CONNECTED_CLOUD_ENVIRONMENTS : [];
  const hasEnvironments = managedEnvironments.length > 0;
  const accentColor = useThemeColor("--color-icon-muted");
  const headerIconColor = useThemeColor("--color-icon");

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <>
          {/* Android renders its own in-screen header instead of the native bar. */}
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader
            title="Environments"
            onBack={() => navigation.goBack()}
            actions={[
              {
                accessibilityLabel: "Add environment",
                icon: "plus",
                onPress: () => navigation.dispatch(StackActions.push("SettingsEnvironmentNew")),
              },
            ]}
          />
        </>
      ) : (
        <NativeHeaderToolbar placement="right">
          <NativeHeaderToolbar.Button
            icon="plus"
            onPress={() => navigation.dispatch(StackActions.push("SettingsEnvironmentNew"))}
            separateBackground
            tintColor={headerIconColor}
          />
        </NativeHeaderToolbar>
      )}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="px-5 pt-4"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 18,
        }}
      >
        {hasEnvironments ? (
          <EnvironmentList
            environments={managedEnvironments}
            onSelect={(environmentId) =>
              navigation.dispatch(
                StackActions.push("SettingsEnvironmentDetails", { environmentId }),
              )
            }
          />
        ) : (
          <View collapsable={false} className="items-center gap-3 rounded-[24px] bg-card px-6 py-8">
            <View className="h-12 w-12 items-center justify-center rounded-[16px] bg-subtle">
              <SymbolView
                name="point.3.connected.trianglepath.dotted"
                size={20}
                tintColor={accentColor}
                type="monochrome"
              />
            </View>
            <Text className="text-center text-sm leading-normal text-foreground-muted">
              No environments connected yet.{"\n"}Tap{" "}
              <Text className="font-t3-bold text-foreground">+</Text> to add one.
            </Text>
          </View>
        )}

        {/* Keep cloud discovery mounted so linked environments remain available
            even when this device has no direct environments yet. */}
        <CloudEnvironmentRows
          connectedCloudEnvironments={connectedCloudEnvironments}
          onReconnectEnvironment={onReconnectEnvironment}
          {...(SHOWCASE_ENABLED
            ? {
                showcaseAvailableEnvironments: SHOWCASE_AVAILABLE_CLOUD_ENVIRONMENTS,
                showcaseSignedIn: true,
              }
            : {})}
        />
      </ScrollView>
    </View>
  );
}
