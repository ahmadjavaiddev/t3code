import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Platform, Pressable, View } from "react-native";

import { AppText as Text } from "../../components/AppText";
import {
  addBackgroundConnectionStatusListener,
  getBackgroundConnectionStatus,
  requestBackgroundConnectionBatteryOptimizationExemption,
  setBackgroundConnectionEnabled,
  type BackgroundConnectionStatus,
} from "../../native/backgroundConnection";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import {
  readLocalCompletionNotificationPermission,
  requestLocalCompletionNotificationPermission,
  type LocalCompletionNotificationPermission,
} from "../notifications/localCompletionNotifications";
import { SettingsSection } from "../settings/components/SettingsSection";
import { SettingsSwitchRow } from "../settings/components/SettingsSwitchRow";
import {
  backgroundConnectionStatusLabel,
  shouldRequestBackgroundConnectionBatteryExemption,
} from "./settings-model";

function promptForBatteryExemption(
  requestExemption: () => Promise<BackgroundConnectionStatus>,
): void {
  Alert.alert(
    "Allow unrestricted battery use?",
    "Android can otherwise pause the background connection while T3 Code is locked or another app is open.",
    [
      { text: "Not Now", style: "cancel" },
      { text: "Allow", onPress: () => void requestExemption() },
    ],
  );
}

export function SyncSettingsSection() {
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const [status, setStatus] = useState(getBackgroundConnectionStatus);
  const [changing, setChanging] = useState(false);
  const [completionNotificationPermission, setCompletionNotificationPermission] =
    useState<LocalCompletionNotificationPermission>({ type: "unsupported" });

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    setStatus(getBackgroundConnectionStatus());
    const nativeSubscription = addBackgroundConnectionStatusListener(setStatus);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setStatus(getBackgroundConnectionStatus());
      }
    });
    return () => {
      nativeSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    const refreshPermission = () => {
      void readLocalCompletionNotificationPermission()
        .then(setCompletionNotificationPermission)
        .catch(() => setCompletionNotificationPermission({ type: "denied", canAskAgain: true }));
    };
    refreshPermission();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") refreshPermission();
    });
    return () => subscription.remove();
  }, []);

  const requestExemption = useCallback(async () => {
    const next = await requestBackgroundConnectionBatteryOptimizationExemption();
    setStatus(next);
    return next;
  }, []);

  const handleEnabledChange = useCallback(
    async (enabled: boolean) => {
      if (changing) {
        return;
      }
      setChanging(true);
      setStatus((current) => ({ ...current, enabled }));
      const next = await setBackgroundConnectionEnabled(enabled);
      setStatus(next);
      setChanging(false);
      if (shouldRequestBackgroundConnectionBatteryExemption(next)) {
        promptForBatteryExemption(requestExemption);
      }
    },
    [changing, requestExemption],
  );

  const statusLabel = backgroundConnectionStatusLabel(status);
  const canRetryBatteryExemption = shouldRequestBackgroundConnectionBatteryExemption(status);
  const syncWorkingThreadMessages =
    AsyncResult.isSuccess(preferencesResult) &&
    preferencesResult.value.syncWorkingThreadMessages === true;
  const localCompletionNotificationsEnabled =
    AsyncResult.isSuccess(preferencesResult) &&
    preferencesResult.value.localCompletionNotificationsEnabled === true &&
    completionNotificationPermission.type === "granted";

  const handleLocalCompletionNotificationsChange = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        savePreferences({ localCompletionNotificationsEnabled: false });
        return;
      }
      try {
        const permission = await requestLocalCompletionNotificationPermission();
        setCompletionNotificationPermission(permission);
        if (permission.type === "granted") {
          savePreferences({ localCompletionNotificationsEnabled: true });
          return;
        }
      } catch {
        // The alert below covers native permission/channel failures too.
      }
      savePreferences({ localCompletionNotificationsEnabled: false });
      Alert.alert(
        "Notifications unavailable",
        "Allow notifications for T3 Code in Android settings, then try again.",
      );
    },
    [savePreferences],
  );

  return (
    <View className="gap-3">
      <SettingsSection title="Sync">
        <SettingsSwitchRow
          icon="arrow.triangle.2.circlepath"
          label="Sync Working Threads"
          value={syncWorkingThreadMessages}
          onValueChange={(value) => savePreferences({ syncWorkingThreadMessages: value })}
        />
        {Platform.OS === "android" ? (
          <>
            <SettingsSwitchRow
              disabled={!status.supported || changing}
              icon="bolt.horizontal.circle"
              label="Keep connected in background"
              value={status.enabled}
              onValueChange={(enabled) => void handleEnabledChange(enabled)}
            />
            <SettingsSwitchRow
              disabled={!status.supported || !status.enabled}
              icon="bell.badge"
              label="Local completion alerts"
              subtitle={
                status.enabled
                  ? "Posted by this device—no EAS or T3 Connect push."
                  : "Turn on the background connection first."
              }
              value={localCompletionNotificationsEnabled}
              onValueChange={(enabled) => void handleLocalCompletionNotificationsChange(enabled)}
            />
            <View className="border-t border-border px-4 py-3">
              {canRetryBatteryExemption ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void requestExemption()}
                  className="py-1"
                >
                  <Text className="text-sm font-t3-medium text-foreground">{statusLabel}</Text>
                  <Text className="mt-1 text-sm text-foreground-muted">
                    Tap to allow unrestricted battery use.
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-sm font-t3-medium text-foreground-muted">{statusLabel}</Text>
              )}
            </View>
          </>
        ) : null}
      </SettingsSection>
    </View>
  );
}

// Retained for focused background-connection tests and callers that only care
// about the Android behavior now presented inside the broader Sync section.
export const BackgroundConnectionSettingsSection = SyncSettingsSection;
