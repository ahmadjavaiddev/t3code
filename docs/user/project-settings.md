# Project settings

Project settings control the name, icon, new-thread defaults, checkouts, and saved actions for a
project. On web and desktop, open the project selector and choose its settings button. On mobile,
open **Settings** → **Projects**, choose the settings button beside a project heading, or open
**Project settings** from a thread's actions menu.

Changes to the project name, icon, default model, and default workspace apply to every checkout in
the displayed project group. Checkout paths, grouping rules, and saved actions apply only to the
checkout selected in the **Checkout** section.

Mobile checkout grouping rules are stored on that mobile device. This lets one phone keep matching
repositories together while another device lists those checkouts separately.

Removing a project or checkout also removes its threads and conversation history, but never deletes
files from disk.

## Customize a project icon

T3 Code selects a project icon automatically. It checks `t3.json`, common favicon and app icon
paths, and icon links in project HTML files.

To choose a different icon on web or desktop:

1. Open the project selector in the sidebar.
2. Select the settings button beside the project.
3. Under **Project icon**, select **Choose file**.
4. Choose an image file.

T3 Code supports SVG, PNG, ICO, JPEG, GIF, AVIF, and WebP files. The selected path applies to
each checkout in the project group and appears on your connected clients.

To use automatic detection again, select **Automatic**.

On mobile, enter the image's project-relative path under **Icon file**. Clear the field to restore
automatic detection.

## Saved actions

The **Actions** section creates and edits commands for the selected checkout. An action can use one
of the built-in icons and can optionally run when a new worktree is created. Only one action per
checkout can be marked as the worktree setup action.

Preview URLs are used by desktop. Mobile can preserve and edit them even though previews do not open
inside the mobile app.
