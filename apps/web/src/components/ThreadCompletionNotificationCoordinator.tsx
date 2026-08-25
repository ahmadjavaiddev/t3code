import { useNavigate } from "@tanstack/react-router";
import {
  updateThreadCompletionNotificationTracker,
  type ThreadCompletionNotificationTracker,
} from "@t3tools/client-runtime/state/thread-completion-notifications";
import { useEffect, useMemo, useRef } from "react";

import { APP_BASE_NAME } from "../branding";
import { useClientSettings } from "../hooks/useSettings";
import { useProjects, useThreadShells } from "../state/entities";
import { buildThreadRouteParams } from "../threadRoutes";
import {
  readThreadCompletionNotificationPermission,
  shouldShowThreadCompletionNotification,
} from "../threadCompletionNotifications";

export function ThreadCompletionNotificationCoordinator() {
  const enabled = useClientSettings((settings) => settings.notifyOnThreadCompletion);
  const threads = useThreadShells();
  const projects = useProjects();
  const navigate = useNavigate();
  const trackerRef = useRef<ThreadCompletionNotificationTracker | null>(null);
  const projectTitleByKey = useMemo(
    () =>
      new Map(projects.map((project) => [`${project.environmentId}:${project.id}`, project.title])),
    [projects],
  );

  useEffect(() => {
    if (!enabled) {
      trackerRef.current = null;
      return;
    }

    const update = updateThreadCompletionNotificationTracker(trackerRef.current, threads);
    trackerRef.current = update.tracker;

    if (
      !shouldShowThreadCompletionNotification({
        enabled,
        permission: readThreadCompletionNotificationPermission(),
        visibilityState: document.visibilityState,
        documentHasFocus: document.hasFocus(),
      })
    ) {
      return;
    }

    for (const completion of update.completions) {
      const projectTitle = projectTitleByKey.get(
        `${completion.environmentId}:${completion.projectId}`,
      );
      try {
        const notification = new Notification("Task completed", {
          body: projectTitle
            ? `${completion.threadTitle} · ${projectTitle}`
            : completion.threadTitle,
          tag: `${APP_BASE_NAME}:thread-completed:${completion.key}`,
        });
        notification.addEventListener("click", () => {
          notification.close();
          window.focus();
          void navigate({
            to: "/$environmentId/$threadId",
            params: buildThreadRouteParams({
              environmentId: completion.environmentId,
              threadId: completion.threadId,
            }),
          });
        });
      } catch (error) {
        console.warn("[THREAD_COMPLETION_NOTIFICATION] delivery failed", error);
      }
    }
  }, [enabled, navigate, projectTitleByKey, threads]);

  return null;
}
