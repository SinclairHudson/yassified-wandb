# Yassified W&B

<p align="center">
  <img src="yassified-wandb-logo.png" alt="Yassified W&B logo" width="200">
</p>

A small Chrome extension that makes Weights & Biases plots easier to read in presentations.

Supports `wandb.ai` and W&B workspaces at `forge.coreweave.com/wandb/`.

## What it does

- Replaces exact W&B plot titles with readable display titles.
- Enlarges plot titles and experiment names in legends.
- Double-click a legend name to edit **Display name (this workspace)** across
  all graphs in the current workspace, preserving the original run name.
- Applies changes live as W&B rerenders the workspace.
- Handles titles split into highlighted fragments by W&B metric search.
- Stores settings with Chrome sync.

The included default mapping is:

`val/detection/maps/map_all` → `Validation mAP`

## Install locally

You need Google Chrome (or another Chromium-based browser) and access to this
repository. The extension has no build step or runtime dependencies.

1. Clone this repository and enter the checkout:

   ```sh
   git clone https://github.com/SinclairHudson/yassified-wandb.git
   cd yassified-wandb
   ```

2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select the cloned `yassified-wandb` folder.
6. Open or refresh a W&B page on `wandb.ai` or `forge.coreweave.com/wandb/`.

Click the extension's toolbar icon to add title mappings or change the title and legend sizes. Pin it from Chrome's Extensions menu if you want it to stay visible.

### Workspace display-name editing

Double-click a run's name in a line-plot legend. The extension opens W&B's native
editor beside the legend and focuses **Display name (this workspace)**. Type a
label and press **Enter** (or click **Save**). **Escape** or **Cancel** discards it.
Clear the field and save to remove the workspace override.

This updates W&B's actual workspace setting, so W&B applies the label throughout
that workspace and persists it using its usual autosave. Other workspaces and
the original run name remain unchanged. The original-name field is hidden and
read-only in this shortcut; saving is blocked if its value changes. The extension
does not call the run-renaming API or store a separate local legend alias.

The run must be listed in the workspace's runs table so the shortcut can open
its native menu. If it is filtered out or not loaded, show it in the runs table
and try again. Single-click legend navigation is delayed briefly to recognize
a double-click. W&B's native save errors remain visible in the editor.

Version 0.2.2 incorrectly changed the global run name. Upgrading prevents further
changes through that path; previously saved global names are not automatically
restored.

### Reload an existing installation

If Chrome already loads the extension from this checkout:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Find **Yassified W&B** and click its reload button (the circular arrow).
3. Check that its version is **0.2.4**. If Chrome asks you to approve access to
   `forge.coreweave.com`, approve it so the extension can style the W&B workspace.
4. Refresh your W&B tab, for example
   `https://forge.coreweave.com/wandb/<entity>/<project>`.

Reloading the existing extension preserves your saved title mappings and font sizes.
If the extension is missing or points to another checkout, use **Load unpacked**
and select the updated folder containing `manifest.json`.

## If a W&B element is not styled

W&B is a dynamic web app and occasionally changes its markup. Save a page sample while the relevant plots and legends are visible:

1. In Chrome, use **File → Save Page As…**.
2. Choose **Webpage, Complete**.
3. Save it somewhere inside this project (for example, `samples/wandb-workspace.html`).

The saved page may include experiment names or other workspace information. Review it before sharing. A smaller and safer alternative is to open DevTools, inspect the chart, right-click its nearest enclosing panel element, and choose **Copy → Copy outerHTML**; paste that into a text file in `samples/`.

## Development

After editing extension files, click the reload button on `chrome://extensions`, then refresh W&B. No build step or dependencies are required.

With Node.js available, run `npm install` once, then `npm test` to check settings,
title mappings, and the workspace-only legend editor. The test DOM library is a
development dependency; the extension itself has no runtime dependencies.

When pulling later updates, reload the extension from `chrome://extensions`
before refreshing W&B.
