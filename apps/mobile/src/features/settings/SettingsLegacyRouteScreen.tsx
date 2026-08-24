import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigation } from "@react-navigation/native";
import { AsyncResult } from "effect/unstable/reactivity";
import { Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { useThreadListV2Enabled } from "../threads/use-thread-list-v2-enabled";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsSwitchRow } from "./components/SettingsSwitchRow";

export function SettingsLegacyRouteScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const preferences = useAtomValue(mobilePreferencesAtom);
  const threadListV2Enabled = useThreadListV2Enabled();
  const planModeEnabled =
    AsyncResult.isSuccess(preferences) && preferences.value.planModeEnabled === true;

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <>
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader title="Legacy" onBack={() => navigation.goBack()} />
        </>
      ) : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        <SettingsSection title="Legacy features">
          <SettingsSwitchRow
            icon="sidebar.left"
            label="Legacy Thread List"
            value={!threadListV2Enabled}
            onValueChange={(value) => savePreferences({ legacyThreadListEnabled: value })}
          />
          <SettingsSwitchRow
            icon="hammer"
            label="Plan Mode"
            value={planModeEnabled}
            onValueChange={(value) => savePreferences({ planModeEnabled: value })}
          />
        </SettingsSection>
        <Text className="px-2 text-sm leading-normal text-foreground-muted">
          Opt into retired interfaces kept for compatibility. Plan Mode restores the Build/Plan
          control; otherwise every task runs in Build mode.
        </Text>
      </ScrollView>
    </View>
  );
}
