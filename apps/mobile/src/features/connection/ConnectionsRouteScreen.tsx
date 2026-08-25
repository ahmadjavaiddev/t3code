import { NativeHeaderToolbar } from "../../native/StackHeader";
import { StackActions, useNavigation } from "@react-navigation/native";
import { SymbolView } from "../../components/AppSymbol";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "../../lib/useThemeColor";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { useRemoteConnections } from "../../state/use-remote-environment-registry";
import { EnvironmentList } from "./EnvironmentList";

export function ConnectionsRouteScreen() {
  const { connectedEnvironments } = useRemoteConnections();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const hasEnvironments = connectedEnvironments.length > 0;

  const accentColor = useThemeColor("--color-icon-muted");

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <AndroidScreenHeader
          title="Environments"
          onBack={() => navigation.goBack()}
          actions={[
            {
              accessibilityLabel: "Add environment",
              icon: "plus",
              onPress: () => navigation.navigate("ConnectionsNew"),
            },
          ]}
        />
      ) : (
        <NativeHeaderToolbar placement="right">
          <NativeHeaderToolbar.Button
            icon="plus"
            onPress={() => navigation.navigate("ConnectionsNew")}
            separateBackground
          />
        </NativeHeaderToolbar>
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
        {hasEnvironments ? (
          <EnvironmentList
            environments={connectedEnvironments}
            onSelect={(environmentId) =>
              navigation.dispatch(StackActions.push("EnvironmentDetails", { environmentId }))
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
      </ScrollView>
    </View>
  );
}
