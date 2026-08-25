import type { ProjectScriptIcon } from "@t3tools/contracts";
import type { MenuAction } from "@react-native-menu/menu";
import { Pressable, View } from "react-native";

import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { SymbolView, type AppSymbolName } from "../../components/AppSymbol";
import { ControlPillMenu } from "../../components/ControlPill";
import { ThemedSwitch } from "../../components/ThemedSwitch";
import { useThemeColor } from "../../lib/useThemeColor";
import { PROJECT_SCRIPT_ICON_LABELS, type ProjectScriptDraft } from "./project-settings.logic";

export const PROJECT_SCRIPT_ICON_SYMBOLS: Record<ProjectScriptIcon, AppSymbolName> = {
  play: "play.fill",
  test: "checkmark.circle",
  lint: "checklist",
  configure: "gearshape",
  build: "hammer",
  debug: "ladybug",
};

const PROJECT_SCRIPT_ICON_MENU_IMAGES: Record<ProjectScriptIcon, string> = {
  play: "play.fill",
  test: "checkmark.circle",
  lint: "checklist",
  configure: "gearshape",
  build: "hammer",
  debug: "ladybug",
};

function menuEventId(event: { nativeEvent: { event: string } }): string {
  return event.nativeEvent.event;
}

export function ProjectSettingsValueRow(props: {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
  readonly actions: MenuAction[];
  readonly onSelect: (id: string) => void;
  readonly disabled?: boolean;
  readonly first?: boolean;
}) {
  const chevronColor = useThemeColor("--color-chevron");
  const content = (
    <View
      accessibilityLabel={`${props.label}, ${props.value}`}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      className={`${props.first ? "" : "border-t border-border-subtle "}flex-row items-center gap-3 p-4 ${props.disabled ? "opacity-50" : ""}`}
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-base font-t3-medium text-foreground">{props.label}</Text>
        {props.description ? (
          <Text className="text-sm leading-normal text-foreground-muted">{props.description}</Text>
        ) : null}
      </View>
      <Text className="max-w-[42%] text-right text-sm text-foreground-muted" numberOfLines={2}>
        {props.value}
      </Text>
      <SymbolView
        name="chevron.right"
        size={15}
        tintColor={chevronColor}
        type="monochrome"
        weight="semibold"
      />
    </View>
  );
  if (props.disabled) return content;
  return (
    <ControlPillMenu
      actions={props.actions}
      onPressAction={(event) => props.onSelect(menuEventId(event))}
    >
      {content}
    </ControlPillMenu>
  );
}

export function ProjectSettingsButton(props: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      className={`${props.destructive ? "border-danger/40 bg-danger/10" : "border-border bg-subtle"} min-h-11 items-center justify-center rounded-full border px-5 ${props.disabled ? "opacity-50" : ""}`}
    >
      <Text
        className={`text-sm font-t3-bold ${props.destructive ? "text-danger-foreground" : "text-foreground"}`}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

export function ProjectScriptEditor(props: {
  readonly draft: ProjectScriptDraft;
  readonly saving: boolean;
  readonly onChange: (draft: ProjectScriptDraft) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
  readonly onDelete: (() => void) | null;
}) {
  const iconActions = (Object.keys(PROJECT_SCRIPT_ICON_LABELS) as ProjectScriptIcon[]).map(
    (icon) => ({
      id: `icon:${icon}`,
      title: PROJECT_SCRIPT_ICON_LABELS[icon],
      image: PROJECT_SCRIPT_ICON_MENU_IMAGES[icon],
      state: props.draft.icon === icon ? ("on" as const) : ("off" as const),
    }),
  );
  return (
    <View className="gap-4 border-t border-border-subtle p-4">
      <TextInput
        accessibilityLabel="Action name"
        autoCapitalize="words"
        editable={!props.saving}
        onChangeText={(name) => props.onChange({ ...props.draft, name })}
        placeholder="Action name"
        value={props.draft.name}
      />
      <TextInput
        accessibilityLabel="Action command"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!props.saving}
        multiline
        onChangeText={(command) => props.onChange({ ...props.draft, command })}
        placeholder="Command, for example vp test"
        value={props.draft.command}
      />
      <ProjectSettingsValueRow
        first
        actions={iconActions}
        disabled={props.saving}
        label="Icon"
        value={PROJECT_SCRIPT_ICON_LABELS[props.draft.icon]}
        onSelect={(id) => {
          const icon = id.replace("icon:", "") as ProjectScriptIcon;
          if (icon in PROJECT_SCRIPT_ICON_LABELS) props.onChange({ ...props.draft, icon });
        }}
      />
      <View className="flex-row items-center justify-between rounded-2xl bg-subtle px-4 py-2">
        <View className="min-w-0 flex-1 pr-4">
          <Text className="text-base font-t3-medium">Run when a worktree is created</Text>
          <Text className="text-sm text-foreground-muted">
            Only one setup action can be active.
          </Text>
        </View>
        <ThemedSwitch
          disabled={props.saving}
          value={props.draft.runOnWorktreeCreate}
          onValueChange={(runOnWorktreeCreate) =>
            props.onChange({ ...props.draft, runOnWorktreeCreate })
          }
        />
      </View>
      <TextInput
        accessibilityLabel="Preview URL"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!props.saving}
        onChangeText={(previewUrl) => props.onChange({ ...props.draft, previewUrl })}
        placeholder="Preview URL (optional, desktop only)"
        value={props.draft.previewUrl}
      />
      {props.draft.previewUrl.trim() ? (
        <View className="flex-row items-center justify-between rounded-2xl bg-subtle px-4 py-2">
          <Text className="min-w-0 flex-1 pr-4 text-base font-t3-medium">
            Open preview automatically
          </Text>
          <ThemedSwitch
            disabled={props.saving}
            value={props.draft.autoOpenPreview}
            onValueChange={(autoOpenPreview) => props.onChange({ ...props.draft, autoOpenPreview })}
          />
        </View>
      ) : null}
      <View className="flex-row flex-wrap justify-end gap-2">
        {props.onDelete ? (
          <ProjectSettingsButton
            destructive
            disabled={props.saving}
            label="Delete"
            onPress={props.onDelete}
          />
        ) : null}
        <ProjectSettingsButton disabled={props.saving} label="Cancel" onPress={props.onCancel} />
        <ProjectSettingsButton disabled={props.saving} label="Save action" onPress={props.onSave} />
      </View>
    </View>
  );
}
