import { StackActions, useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text } from "../../components/AppText";
import { ProjectFavicon } from "../../components/ProjectFavicon";
import { SymbolView } from "../../components/AppSymbol";
import { useThemeColor } from "../../lib/useThemeColor";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useProjects } from "../../state/entities";
import { useMobileProjectGroupingSettings } from "../../state/project-grouping";
import { buildHomeProjectScopes } from "../home/homeThreadList";
import { SettingsSection } from "./components/SettingsSection";

export function SettingsProjectsRouteScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const projects = useProjects();
  const groupingSettings = useMobileProjectGroupingSettings();
  const chevronColor = useThemeColor("--color-chevron");
  const groups = useMemo(
    () =>
      [
        ...buildHomeProjectScopes({
          projects,
          environmentId: null,
          projectGroupingMode: groupingSettings.sidebarProjectGroupingMode,
          projectGroupingOverrides: groupingSettings.sidebarProjectGroupingOverrides,
        }),
      ].sort((left, right) => left.title.localeCompare(right.title)),
    [groupingSettings, projects],
  );

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      {Platform.OS === "android" ? (
        <>
          <NativeStackScreenOptions options={{ headerShown: false }} />
          <AndroidScreenHeader title="Projects" onBack={() => navigation.goBack()} />
        </>
      ) : null}
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        {groups.length > 0 ? (
          <SettingsSection card title="Projects">
            {groups.map((group, index) => (
              <Pressable
                key={group.key}
                accessibilityLabel={`Project settings for ${group.title}`}
                accessibilityRole="button"
                className={`${index === 0 ? "" : "border-t border-border-subtle "}flex-row items-center gap-3 p-4`}
                onPress={() =>
                  navigation.dispatch(
                    StackActions.push("SettingsProjectDetails", {
                      environmentId: String(group.representative.environmentId),
                      projectId: String(group.representative.id),
                    }),
                  )
                }
              >
                <ProjectFavicon
                  environmentId={group.representative.environmentId}
                  faviconPath={group.representative.faviconPath}
                  projectTitle={group.title}
                  size={34}
                  workspaceRoot={group.representative.workspaceRoot}
                />
                <View className="min-w-0 flex-1">
                  <Text className="text-base font-t3-bold" numberOfLines={1}>
                    {group.title}
                  </Text>
                  <Text className="text-sm text-foreground-muted" numberOfLines={1}>
                    {group.projects.length === 1
                      ? group.representative.workspaceRoot
                      : `${group.projects.length} checkouts`}
                  </Text>
                </View>
                <SymbolView
                  name="chevron.right"
                  size={16}
                  tintColor={chevronColor}
                  type="monochrome"
                  weight="semibold"
                />
              </Pressable>
            ))}
          </SettingsSection>
        ) : (
          <View className="items-center gap-2 rounded-[24px] bg-card px-6 py-8">
            <Text className="text-lg font-t3-bold">No projects yet</Text>
            <Text className="text-center text-sm leading-normal text-foreground-muted">
              Add a project from the new-task flow, then return here to configure it.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
