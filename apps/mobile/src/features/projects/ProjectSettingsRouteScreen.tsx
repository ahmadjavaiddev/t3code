import { useAtomSet } from "@effect/atom-react";
import { deriveProjectGroupingOverrideKey } from "@t3tools/client-runtime/state/project-grouping";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { type ModelSelection, type ProjectScript, type ThreadEnvMode } from "@t3tools/contracts";
import type { MenuAction } from "@react-native-menu/menu";
import { useNavigation, type StaticScreenProps } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AndroidScreenHeader } from "../../components/AndroidScreenHeader";
import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { ProjectFavicon } from "../../components/ProjectFavicon";
import { scopedProjectKey } from "../../lib/scopedEntities";
import { useThemeColor } from "../../lib/useThemeColor";
import { buildModelOptions, groupByProvider } from "../../lib/modelOptions";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useEnvironmentServerConfig, useProjects, useThreadShells } from "../../state/entities";
import {
  mobileProjectGroupingOverridesPatch,
  useMobileProjectGroupingSettings,
} from "../../state/project-grouping";
import { updateMobilePreferencesAtom } from "../../state/preferences";
import { projectEnvironment } from "../../state/projects";
import { useAtomCommand } from "../../state/use-atom-command";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import { SettingsSection } from "../settings/components/SettingsSection";
import { buildHomeProjectScopes } from "../home/homeThreadList";
import {
  PROJECT_SCRIPT_ICON_SYMBOLS,
  ProjectScriptEditor,
  ProjectSettingsButton,
  ProjectSettingsValueRow,
} from "./ProjectSettingsControls";
import {
  nextProjectScriptId,
  PROJECT_GROUPING_LABELS,
  projectScriptDraft,
  type GroupingChoice,
  type ProjectScriptDraft,
} from "./project-settings.logic";

type ProjectSettingsRouteProps = StaticScreenProps<{
  readonly environmentId: string;
  readonly projectId: string;
}>;

function commandFailureMessage(result: AtomCommandResult<unknown, unknown>): string {
  if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) {
    return "The request did not complete.";
  }
  const error = squashAtomCommandFailure(result);
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

function projectRefKey(project: Pick<EnvironmentProject, "environmentId" | "id">): string {
  return scopedProjectKey(project.environmentId, project.id);
}

export function ProjectSettingsRouteScreen(props: ProjectSettingsRouteProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const projects = useProjects();
  const threads = useThreadShells();
  const groupingSettings = useMobileProjectGroupingSettings();
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const { savedConnectionsById } = useSavedRemoteConnections();
  const updateProject = useAtomCommand(projectEnvironment.update, { reportFailure: false });
  const deleteProject = useAtomCommand(projectEnvironment.delete, { reportFailure: false });
  const writeInProgressRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const mutedIconColor = useThemeColor("--color-icon-muted");
  const chevronColor = useThemeColor("--color-chevron");

  const targetKey = `${props.route.params.environmentId}:${props.route.params.projectId}`;
  const target = projects.find((project) => projectRefKey(project) === targetKey) ?? null;
  const group = useMemo(
    () =>
      target === null
        ? null
        : (buildHomeProjectScopes({
            projects,
            environmentId: null,
            projectGroupingMode: groupingSettings.sidebarProjectGroupingMode,
            projectGroupingOverrides: groupingSettings.sidebarProjectGroupingOverrides,
          }).find((scope) =>
            scope.projects.some((project) => projectRefKey(project) === targetKey),
          ) ?? null),
    [groupingSettings, projects, target, targetKey],
  );
  const representative = group?.representative ?? target;
  const [selectedCheckoutKey, setSelectedCheckoutKey] = useState(targetKey);
  const selectedCheckoutMatch =
    group?.projects.find((project) => projectRefKey(project) === selectedCheckoutKey) ?? null;
  const selectedCheckout = selectedCheckoutMatch ?? representative;
  const serverConfig = useEnvironmentServerConfig(selectedCheckout?.environmentId ?? null);
  const [name, setName] = useState(group?.title ?? target?.title ?? "");
  const [faviconPath, setFaviconPath] = useState(representative?.faviconPath ?? "");
  const [scriptDraft, setScriptDraft] = useState<ProjectScriptDraft | null>(null);

  useEffect(() => {
    setName(group?.title ?? target?.title ?? "");
  }, [group?.key, group?.title, target?.title]);
  useEffect(() => {
    setFaviconPath(representative?.faviconPath ?? "");
  }, [group?.key, representative?.faviconPath]);
  useEffect(() => {
    if (!selectedCheckoutMatch && representative)
      setSelectedCheckoutKey(projectRefKey(representative));
  }, [representative, selectedCheckoutMatch]);
  useEffect(() => setScriptDraft(null), [selectedCheckoutKey]);

  const environmentLabel = useCallback(
    (project: EnvironmentProject) =>
      savedConnectionsById[project.environmentId]?.environmentLabel ?? "Environment",
    [savedConnectionsById],
  );
  const threadCountByProjectKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads) {
      const key = `${thread.environmentId}:${thread.projectId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [threads]);
  const threadCount = useCallback(
    (project: EnvironmentProject) => threadCountByProjectKey.get(projectRefKey(project)) ?? 0,
    [threadCountByProjectKey],
  );
  const groupThreadCount = useMemo(
    () => group?.projects.reduce((total, project) => total + threadCount(project), 0) ?? 0,
    [group?.projects, threadCount],
  );
  const reportFailure = useCallback(
    (title: string, result: AtomCommandResult<unknown, unknown>) => {
      Alert.alert(title, commandFailureMessage(result));
    },
    [],
  );
  const beginWrite = useCallback(() => {
    if (writeInProgressRef.current) return false;
    writeInProgressRef.current = true;
    setSaving(true);
    return true;
  }, []);
  const endWrite = useCallback(() => {
    writeInProgressRef.current = false;
    setSaving(false);
  }, []);

  const updateAllMembers = useCallback(
    async (
      input: Partial<{
        title: string;
        faviconPath: string | null;
        defaultModelSelection: ModelSelection | null;
        defaultThreadEnvMode: ThreadEnvMode | null;
      }>,
      failureTitle: string,
    ) => {
      if (!group || !beginWrite()) return false;
      try {
        for (const member of group.projects) {
          const result = await updateProject({
            environmentId: member.environmentId,
            input: { projectId: member.id, ...input },
          });
          if (result._tag === "Failure") {
            reportFailure(
              group.projects.length > 1
                ? `${failureTitle} on ${environmentLabel(member)}`
                : failureTitle,
              result,
            );
            return false;
          }
        }
        return true;
      } finally {
        endWrite();
      }
    },
    [beginWrite, endWrite, environmentLabel, group, reportFailure, updateProject],
  );

  const updateSelectedCheckout = useCallback(
    async (scripts: ReadonlyArray<ProjectScript>, failureTitle: string) => {
      if (!selectedCheckout || !beginWrite()) return false;
      try {
        const result = await updateProject({
          environmentId: selectedCheckout.environmentId,
          input: { projectId: selectedCheckout.id, scripts },
        });
        if (result._tag === "Failure") {
          reportFailure(failureTitle, result);
          return false;
        }
        return true;
      } finally {
        endWrite();
      }
    },
    [beginWrite, endWrite, reportFailure, selectedCheckout, updateProject],
  );

  const modelOptions = useMemo(
    () => buildModelOptions(serverConfig, representative?.defaultModelSelection ?? null),
    [representative?.defaultModelSelection, serverConfig],
  );
  const providerGroups = useMemo(() => groupByProvider(modelOptions), [modelOptions]);
  const modelByActionId = useMemo(
    () =>
      new Map<string, ModelSelection>(
        modelOptions.map((option) => [`model:${option.key}`, option.selection]),
      ),
    [modelOptions],
  );
  const storedModel = representative?.defaultModelSelection ?? null;
  const selectedModelOption = modelOptions.find(
    (option) =>
      option.selection.instanceId === storedModel?.instanceId &&
      option.selection.model === storedModel.model,
  );
  const modelActions = useMemo<MenuAction[]>(
    () => [
      {
        id: "model:default",
        title: "Use environment default",
        state: storedModel === null ? "on" : "off",
      },
      ...providerGroups.map((provider) => ({
        id: `provider:${provider.providerKey}`,
        title: provider.providerLabel,
        subactions: provider.models.map((model) => ({
          id: `model:${model.key}`,
          title: model.label,
          subtitle: model.subtitle,
          state:
            model.selection.instanceId === storedModel?.instanceId &&
            model.selection.model === storedModel.model
              ? ("on" as const)
              : ("off" as const),
        })),
      })),
    ],
    [providerGroups, storedModel],
  );

  const workspaceMode = representative?.defaultThreadEnvMode ?? null;
  const workspaceActions: MenuAction[] = [
    {
      id: "workspace:inherit",
      title: "Use t3.json or environment default",
      state: workspaceMode === null ? "on" : "off",
    },
    {
      id: "workspace:worktree",
      title: "New worktree",
      state: workspaceMode === "worktree" ? "on" : "off",
    },
    {
      id: "workspace:local",
      title: "Project folder",
      state: workspaceMode === "local" ? "on" : "off",
    },
  ];

  const checkoutActions: MenuAction[] =
    group?.projects.map((project) => ({
      id: `checkout:${projectRefKey(project)}`,
      title: environmentLabel(project),
      subtitle: project.workspaceRoot,
      state: projectRefKey(project) === selectedCheckoutKey ? "on" : "off",
    })) ?? [];
  const selectedGrouping: GroupingChoice = selectedCheckout
    ? (groupingSettings.sidebarProjectGroupingOverrides[
        deriveProjectGroupingOverrideKey(selectedCheckout)
      ] ?? "inherit")
    : "inherit";
  const groupingActions: MenuAction[] = [
    {
      id: "grouping:inherit",
      title: "Use mobile default",
      subtitle: PROJECT_GROUPING_LABELS[groupingSettings.sidebarProjectGroupingMode],
      state: selectedGrouping === "inherit" ? "on" : "off",
    },
    ...(["repository", "repository_path", "separate"] as const).map((mode) => ({
      id: `grouping:${mode}`,
      title: PROJECT_GROUPING_LABELS[mode],
      state: selectedGrouping === mode ? ("on" as const) : ("off" as const),
    })),
  ];

  const saveName = useCallback(async () => {
    const title = name.trim();
    if (!title) {
      Alert.alert("Project name required", "Enter a name for this project.");
      return;
    }
    await updateAllMembers({ title }, "Could not rename project");
  }, [name, updateAllMembers]);
  const saveFavicon = useCallback(async () => {
    const path = faviconPath.trim();
    if (path && !/\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(path)) {
      Alert.alert("Unsupported icon", "Use an AVIF, GIF, ICO, JPG, PNG, SVG, or WebP file.");
      return;
    }
    await updateAllMembers({ faviconPath: path || null }, "Could not update project icon");
  }, [faviconPath, updateAllMembers]);

  const changeGrouping = useCallback(
    (choice: GroupingChoice) => {
      if (!selectedCheckout) return;
      const overrideKey = deriveProjectGroupingOverrideKey(selectedCheckout);
      const next = { ...groupingSettings.sidebarProjectGroupingOverrides };
      if (choice === "inherit") delete next[overrideKey];
      else next[overrideKey] = choice;
      savePreferences(mobileProjectGroupingOverridesPatch(next));
    },
    [groupingSettings.sidebarProjectGroupingOverrides, savePreferences, selectedCheckout],
  );

  const saveScript = useCallback(async () => {
    if (!scriptDraft || !selectedCheckout) return;
    const scriptName = scriptDraft.name.trim();
    const command = scriptDraft.command.trim();
    const previewUrl = scriptDraft.previewUrl.trim();
    if (!scriptName || !command) {
      Alert.alert("Action incomplete", "Enter both an action name and a command.");
      return;
    }
    const scriptId =
      scriptDraft.id ??
      nextProjectScriptId(
        scriptName,
        selectedCheckout.scripts.map((script) => script.id),
      );
    const nextScript: ProjectScript = {
      id: scriptId,
      name: scriptName,
      command,
      icon: scriptDraft.icon,
      runOnWorktreeCreate: scriptDraft.runOnWorktreeCreate,
      ...(previewUrl ? { previewUrl, autoOpenPreview: scriptDraft.autoOpenPreview } : {}),
    };
    const nextScripts = scriptDraft.id
      ? selectedCheckout.scripts.map((script) =>
          script.id === scriptDraft.id
            ? nextScript
            : scriptDraft.runOnWorktreeCreate && script.runOnWorktreeCreate
              ? { ...script, runOnWorktreeCreate: false }
              : script,
        )
      : [
          ...selectedCheckout.scripts.map((script) =>
            scriptDraft.runOnWorktreeCreate && script.runOnWorktreeCreate
              ? { ...script, runOnWorktreeCreate: false }
              : script,
          ),
          nextScript,
        ];
    if (await updateSelectedCheckout(nextScripts, "Could not save action")) setScriptDraft(null);
  }, [scriptDraft, selectedCheckout, updateSelectedCheckout]);

  const confirmDeleteScript = useCallback(() => {
    if (!scriptDraft?.id || !selectedCheckout) return;
    Alert.alert("Delete this action?", scriptDraft.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void updateSelectedCheckout(
            selectedCheckout.scripts.filter((script) => script.id !== scriptDraft.id),
            "Could not delete action",
          ).then((updated) => {
            if (updated) setScriptDraft(null);
          });
        },
      },
    ]);
  }, [scriptDraft, selectedCheckout, updateSelectedCheckout]);

  const removeProjects = useCallback(
    async (members: ReadonlyArray<EnvironmentProject>) => {
      if (!beginWrite()) return;
      try {
        for (const member of members) {
          const count = threadCount(member);
          const result = await deleteProject({
            environmentId: member.environmentId,
            input: { projectId: member.id, ...(count > 0 ? { force: true } : {}) },
          });
          if (result._tag === "Failure") {
            reportFailure(`Could not remove ${member.title}`, result);
            return;
          }
        }
        navigation.goBack();
      } finally {
        endWrite();
      }
    },
    [beginWrite, deleteProject, endWrite, navigation, reportFailure, threadCount],
  );
  const confirmRemove = useCallback(
    (members: ReadonlyArray<EnvironmentProject>) => {
      if (!group) return;
      const count = members.reduce((total, member) => total + threadCount(member), 0);
      const wholeGroup = members.length === group.projects.length;
      Alert.alert(
        wholeGroup ? "Remove project?" : "Remove checkout?",
        [
          wholeGroup && members.length > 1
            ? `This removes all ${members.length} project entries.`
            : `This removes ${members[0]?.workspaceRoot ?? "the selected checkout"}.`,
          count > 0
            ? `${count} thread${count === 1 ? "" : "s"} and their conversation history will be deleted.`
            : "No threads will be deleted.",
          "Files on disk are not touched. This cannot be undone.",
        ].join("\n\n"),
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: () => void removeProjects(members) },
        ],
      );
    },
    [group, removeProjects, threadCount],
  );

  if (!group || !representative || !selectedCheckout) {
    return (
      <View className="flex-1 bg-screen">
        {Platform.OS === "android" ? (
          <AndroidScreenHeader title="Project settings" onBack={() => navigation.goBack()} />
        ) : (
          <NativeStackScreenOptions options={{ title: "Project settings" }} />
        )}
        <View className="flex-1 items-center justify-center gap-2 px-8">
          <Text className="text-lg font-t3-bold">Project unavailable</Text>
          <Text className="text-center text-sm text-foreground-muted">
            This project is offline or has been removed.
          </Text>
        </View>
      </View>
    );
  }

  const selectedThreadCount = threadCount(selectedCheckout);
  const nameChanged = name.trim() !== group.title;
  const faviconChanged = faviconPath.trim() !== (representative.faviconPath ?? "");
  const groupingLabel =
    selectedGrouping === "inherit"
      ? `Default (${PROJECT_GROUPING_LABELS[groupingSettings.sidebarProjectGroupingMode]})`
      : PROJECT_GROUPING_LABELS[selectedGrouping];

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      <NativeStackScreenOptions
        options={{ title: group.title, headerShown: Platform.OS !== "android" }}
      />
      {Platform.OS === "android" ? (
        <AndroidScreenHeader
          title={group.title}
          subtitle="Project settings"
          onBack={() => navigation.goBack()}
        />
      ) : null}
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 24 }}
      >
        <View className="flex-row items-center gap-4 rounded-[24px] bg-card p-4">
          <ProjectFavicon
            environmentId={representative.environmentId}
            faviconPath={representative.faviconPath}
            projectTitle={group.title}
            size={48}
            workspaceRoot={representative.workspaceRoot}
          />
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-t3-bold" numberOfLines={1}>
              {group.title}
            </Text>
            <Text className="text-sm text-foreground-muted">
              {group.projects.length === 1 ? "1 checkout" : `${group.projects.length} checkouts`} ·{" "}
              {groupThreadCount} thread{groupThreadCount === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        <SettingsSection card title="Project">
          <View className="gap-3 p-4">
            <Text className="text-base font-t3-medium">Name</Text>
            <TextInput
              accessibilityLabel="Project name"
              editable={!saving}
              onChangeText={setName}
              onSubmitEditing={() => void saveName()}
              returnKeyType="done"
              value={name}
            />
            {nameChanged ? (
              <View className="items-end">
                <ProjectSettingsButton
                  disabled={saving}
                  label="Save name"
                  onPress={() => void saveName()}
                />
              </View>
            ) : null}
          </View>
          <View className="gap-2 border-t border-border-subtle p-4">
            <Text className="text-base font-t3-medium">Icon file</Text>
            <Text className="text-sm text-foreground-muted">
              Enter an image path from the project. Leave it empty to detect an icon automatically.
            </Text>
            <TextInput
              accessibilityLabel="Project icon path"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              onChangeText={setFaviconPath}
              placeholder="Automatic"
              value={faviconPath}
            />
            {faviconChanged ? (
              <View className="items-end">
                <ProjectSettingsButton
                  disabled={saving}
                  label="Save icon"
                  onPress={() => void saveFavicon()}
                />
              </View>
            ) : null}
          </View>
        </SettingsSection>

        <SettingsSection card title="New threads">
          <ProjectSettingsValueRow
            first
            actions={modelActions}
            disabled={saving || modelOptions.length === 0}
            label="Model"
            description="The initial model for every checkout in this project."
            value={
              storedModel === null
                ? "Environment default"
                : (selectedModelOption?.label ?? storedModel.model)
            }
            onSelect={(id) => {
              if (id === "model:default")
                void updateAllMembers(
                  { defaultModelSelection: null },
                  "Could not update default model",
                );
              else {
                const selection = modelByActionId.get(id);
                if (selection)
                  void updateAllMembers(
                    { defaultModelSelection: selection },
                    "Could not update default model",
                  );
              }
            }}
          />
          <ProjectSettingsValueRow
            actions={workspaceActions}
            disabled={saving}
            label="Workspace"
            description="Where new threads start for every checkout in this project."
            value={
              workspaceMode === null
                ? "Default"
                : workspaceMode === "worktree"
                  ? "New worktree"
                  : "Project folder"
            }
            onSelect={(id) => {
              const mode = id.replace("workspace:", "");
              if (mode === "inherit" || mode === "worktree" || mode === "local") {
                void updateAllMembers(
                  { defaultThreadEnvMode: mode === "inherit" ? null : mode },
                  "Could not update workspace default",
                );
              }
            }}
          />
        </SettingsSection>

        <SettingsSection card title="Checkout">
          {group.projects.length > 1 ? (
            <ProjectSettingsValueRow
              first
              actions={checkoutActions}
              label="Selected checkout"
              value={environmentLabel(selectedCheckout)}
              onSelect={(id) => {
                if (id.startsWith("checkout:"))
                  setSelectedCheckoutKey(id.slice("checkout:".length));
              }}
            />
          ) : null}
          <View
            className={`${group.projects.length > 1 ? "border-t border-border-subtle " : ""}gap-2 p-4`}
          >
            <Text className="text-sm font-t3-medium text-foreground-muted">Path</Text>
            <Text selectable className="font-mono text-sm leading-normal text-foreground">
              {selectedCheckout.workspaceRoot}
            </Text>
            <Text className="text-sm text-foreground-muted">
              {environmentLabel(selectedCheckout)} · {selectedThreadCount} thread
              {selectedThreadCount === 1 ? "" : "s"}
            </Text>
          </View>
          <ProjectSettingsValueRow
            actions={groupingActions}
            label="Project grouping"
            description="Controls how this checkout joins projects on this mobile device."
            value={groupingLabel}
            onSelect={(id) => {
              const value = id.replace("grouping:", "") as GroupingChoice;
              if (
                value === "inherit" ||
                value === "repository" ||
                value === "repository_path" ||
                value === "separate"
              )
                changeGrouping(value);
            }}
          />
          {group.projects.length > 1 ? (
            <View className="items-start border-t border-border-subtle p-4">
              <ProjectSettingsButton
                destructive
                disabled={saving}
                label="Remove checkout"
                onPress={() => confirmRemove([selectedCheckout])}
              />
            </View>
          ) : null}
        </SettingsSection>

        <SettingsSection card title="Actions">
          <View className="flex-row items-center justify-between gap-4 p-4">
            <View className="min-w-0 flex-1">
              <Text className="text-base font-t3-medium">Saved actions</Text>
              <Text className="text-sm text-foreground-muted">
                Saved only in {environmentLabel(selectedCheckout)}.
              </Text>
            </View>
            <ProjectSettingsButton
              disabled={saving || scriptDraft !== null}
              label="Add"
              onPress={() => setScriptDraft(projectScriptDraft(null))}
            />
          </View>
          {selectedCheckout.scripts.length === 0 && scriptDraft === null ? (
            <Text className="border-t border-border-subtle px-4 py-5 text-sm text-foreground-muted">
              No actions configured for this checkout.
            </Text>
          ) : null}
          {selectedCheckout.scripts.map((script) => (
            <Pressable
              key={script.id}
              accessibilityLabel={`Edit ${script.name}`}
              accessibilityRole="button"
              disabled={saving || scriptDraft !== null}
              onPress={() => setScriptDraft(projectScriptDraft(script))}
              className="flex-row items-center gap-3 border-t border-border-subtle p-4"
            >
              <SymbolView
                name={PROJECT_SCRIPT_ICON_SYMBOLS[script.icon]}
                size={19}
                tintColor={mutedIconColor}
                type="monochrome"
              />
              <View className="min-w-0 flex-1">
                <Text className="text-base font-t3-medium" numberOfLines={1}>
                  {script.name}
                </Text>
                <Text className="font-mono text-sm text-foreground-muted" numberOfLines={1}>
                  {script.command}
                </Text>
              </View>
              {script.runOnWorktreeCreate ? (
                <Text className="text-xs text-foreground-muted">setup</Text>
              ) : null}
              <SymbolView
                name="chevron.right"
                size={15}
                tintColor={chevronColor}
                type="monochrome"
              />
            </Pressable>
          ))}
          {scriptDraft ? (
            <ProjectScriptEditor
              draft={scriptDraft}
              saving={saving}
              onCancel={() => setScriptDraft(null)}
              onChange={setScriptDraft}
              onDelete={scriptDraft.id ? confirmDeleteScript : null}
              onSave={() => void saveScript()}
            />
          ) : null}
        </SettingsSection>

        <SettingsSection card title="Danger">
          <View className="gap-3 p-4">
            <Text className="text-sm leading-normal text-foreground-muted">
              Remove {group.projects.length > 1 ? "every checkout and its" : "this project and its"}{" "}
              threads. Files on disk are never touched.
            </Text>
            <View className="items-start">
              <ProjectSettingsButton
                destructive
                disabled={saving}
                label={group.projects.length > 1 ? "Remove project everywhere" : "Remove project"}
                onPress={() => confirmRemove(group.projects)}
              />
            </View>
          </View>
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
