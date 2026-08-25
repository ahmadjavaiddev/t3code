import type { MenuAction } from "@react-native-menu/menu";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTextInput as TextInput } from "../../components/AppText";
import { ComposerAttachmentStrip } from "../../components/ComposerAttachmentStrip";
import {
  ComposerInlineControl,
  ComposerSelectControl,
  ComposerToolbarButton,
  ComposerToolbarRow,
  ComposerToolbarScroller,
} from "../../components/ComposerToolbar";
import { ControlPillMenu } from "../../components/ControlPill";
import { themeColorWithAlpha } from "../../lib/mobileTheme";
import { useThemeColor } from "../../lib/useThemeColor";
import type { DraftComposerImageAttachment } from "../../lib/composerImages";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { ComposerSurface } from "../threads/ThreadComposer";
import {
  PROJECT_TODO_STATUSES,
  projectTodoScopeKey,
  projectTodoStatusLabel,
  type ProjectTodoStatus,
} from "./project-todos";

export function ProjectTodoComposer(props: {
  readonly canSubmit: boolean;
  readonly attachments: ReadonlyArray<DraftComposerImageAttachment>;
  readonly isEditing: boolean;
  readonly project: EnvironmentProject | null;
  readonly projectFallbackTitle: string | null;
  readonly projectSelectionLocked: boolean;
  readonly projects: ReadonlyArray<EnvironmentProject>;
  readonly status: ProjectTodoStatus;
  readonly submitting: boolean;
  readonly text: string;
  readonly onChangeProject: (projectKey: string) => void;
  readonly onChangeStatus: (status: ProjectTodoStatus) => void;
  readonly onChangeText: (text: string) => void;
  readonly onAddImages: () => void;
  readonly onClose: () => void;
  readonly onRemoveImage: (imageId: string) => void;
  readonly onSubmit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const sheetColor = String(useThemeColor("--color-sheet"));
  const projectActions = useMemo<MenuAction[]>(
    () =>
      props.projects.map((project) => ({
        id: projectTodoScopeKey(project),
        title: project.title,
        subtitle: project.workspaceRoot,
        state:
          projectTodoScopeKey(project) === (props.project && projectTodoScopeKey(props.project))
            ? "on"
            : "off",
      })),
    [props.project, props.projects],
  );
  const projectControl = (
    <ComposerInlineControl
      accessibilityLabel={`Project: ${props.project?.title ?? props.projectFallbackTitle ?? "Choose project"}`}
      disabled={props.submitting}
      emphasized
      icon="folder"
      label={props.project?.title ?? props.projectFallbackTitle ?? "Choose project"}
      maxWidth={172}
      static={props.projectSelectionLocked || props.projects.length === 0}
    />
  );

  return (
    <View
      className="bg-sheet px-4 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      accessibilityLabel={props.isEditing ? "Edit task composer" : "New task composer"}
    >
      <ComposerSurface
        animateLayout={false}
        isDarkMode={themeAppearance === "dark"}
        style={{
          borderRadius: 26,
          minHeight: 146,
          overflow: "hidden",
          paddingBottom: 6,
          paddingHorizontal: 14,
          paddingTop: 14,
        }}
      >
        {props.attachments.length > 0 ? (
          <View className="pb-2">
            <ComposerAttachmentStrip
              attachments={props.attachments}
              imageBorderRadius={14}
              imageSize={60}
              onRemove={props.onRemoveImage}
              removeButtonPlacement="gutter"
            />
          </View>
        ) : null}
        <TextInput
          accessibilityLabel={props.isEditing ? "Edit task or note" : "New task or note"}
          autoFocus
          blurOnSubmit={false}
          className="min-h-[72px] rounded-none border-0 bg-transparent px-1 py-1 text-base"
          editable={!props.submitting}
          multiline
          onChangeText={props.onChangeText}
          placeholder={props.isEditing ? "Update task or note…" : "Add a task or note…"}
          scrollEnabled
          style={{ maxHeight: 160, textAlignVertical: "top" }}
          value={props.text}
        />

        <ComposerToolbarRow paddingBottom={0} paddingHorizontal={0} paddingTop={4}>
          <ComposerToolbarButton
            accessibilityLabel="Close task composer"
            disabled={props.submitting}
            icon="xmark"
            onPress={props.onClose}
            showChevron={false}
          />
          <ComposerToolbarButton
            accessibilityLabel="Attach screenshot or image"
            disabled={props.submitting}
            icon="photo"
            onPress={props.onAddImages}
            showChevron={false}
          />
          <ComposerToolbarScroller
            contentPaddingRight={8}
            fadeOpaque={sheetColor}
            fadeTransparent={themeColorWithAlpha(sheetColor, 0)}
          >
            {props.projectSelectionLocked || props.projects.length === 0 ? (
              projectControl
            ) : (
              <ControlPillMenu
                actions={projectActions}
                onPressAction={({ nativeEvent }) => props.onChangeProject(nativeEvent.event)}
                title="Choose project"
              >
                {projectControl}
              </ControlPillMenu>
            )}
            <ComposerSelectControl
              accessibilityLabel={`Status: ${projectTodoStatusLabel(props.status)}`}
              disabled={props.submitting}
              label={projectTodoStatusLabel(props.status)}
              onSelect={(status) => props.onChangeStatus(status as ProjectTodoStatus)}
              options={PROJECT_TODO_STATUSES.map((status) => ({
                id: status,
                label: projectTodoStatusLabel(status),
              }))}
              selectedId={props.status}
            />
          </ComposerToolbarScroller>
          <ComposerToolbarButton
            accessibilityLabel={props.isEditing ? "Save task" : "Add task or note"}
            disabled={!props.canSubmit || props.submitting}
            icon={props.isEditing ? "checkmark" : "arrow.up"}
            onPress={props.onSubmit}
            showChevron={false}
            variant="primary"
          />
        </ComposerToolbarRow>
      </ComposerSurface>
    </View>
  );
}
