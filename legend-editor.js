(function () {
  "use strict";

  const LEGEND_NAME = '[data-test="line-plot-legend-run-name"], [data-testid="line-plot-legend-run-name"]';
  let opening = false;
  let active;
  let clickTimer;

  function enabled() {
    return document.documentElement.classList.contains("yw-enabled");
  }

  function runPath(link) {
    try {
      const url = new URL(link.href, location.href);
      return url.origin === location.origin && /\/runs\/[^/]+\/?$/.test(url.pathname)
        ? url.pathname.replace(/\/$/, "") : null;
    } catch { return null; }
  }

  function legendLink(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    const name = element?.closest(LEGEND_NAME);
    return name && (element.closest('a[href*="/runs/"]') || name.querySelector('a[href*="/runs/"]'));
  }

  function nativeMenuButton(link) {
    const path = runPath(link);
    if (!path) return null;
    for (const candidate of document.querySelectorAll('.wb-tree-cell--header-row a[href*="/runs/"]')) {
      if (runPath(candidate) === path) {
        const button = candidate.closest('.wb-tree-cell--header-row').querySelector('button[aria-label="Show run menu"]');
        if (button && !button.disabled) return button;
      }
    }
    return null;
  }

  function inputForLabel(dialog, text) {
    const labels = Array.from(dialog.querySelectorAll("label")).filter(label => label.textContent.trim() === text);
    if (labels.length !== 1 || !labels[0].htmlFor) return null;
    const input = Array.from(dialog.querySelectorAll("input")).find(input => input.id === labels[0].htmlFor);
    return input?.type === "text" ? input : null;
  }

  function fields(dialog) {
    const run = inputForLabel(dialog, "Run name");
    const workspace = inputForLabel(dialog, "Display name (this workspace)");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    const save = buttons.find(button => button.textContent.trim() === "Save");
    const cancel = buttons.find(button => button.textContent.trim() === "Cancel");
    return run && workspace && save && cancel ? { run, workspace, save, cancel } : null;
  }

  function visible(element) {
    return element.isConnected && element.getClientRects().length > 0;
  }

  function waitFor(find) {
    return new Promise((resolve, reject) => {
      let timer;
      const observer = new MutationObserver(check);
      function check() {
        const result = find();
        if (!result) return;
        observer.disconnect();
        clearTimeout(timer);
        resolve(result);
      }
      observer.observe(document.body, { childList: true, subtree: true });
      timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error("W&B's workspace name editor did not open. Try again after closing any open menus."));
      }, 3000);
      check();
    });
  }

  function notice(message) {
    document.querySelector('[data-yw-ui="legend-notice"]')?.remove();
    const element = document.createElement("div");
    element.dataset.ywUi = "legend-notice";
    element.className = "yw-legend-notice";
    element.setAttribute("role", "alert");
    element.textContent = message;
    document.body.append(element);
    setTimeout(() => element.remove(), 7000);
  }

  function prepareDialog(dialog, rect) {
    const native = fields(dialog);
    if (!native) throw new Error("W&B's exact workspace display-name field was not found. No name was changed.");
    const originalRunName = native.run.value;
    const originalField = native.run.closest('[data-component="TextField"]');
    if (!originalField) throw new Error("The run-name field could not be isolated safely. No name was changed.");
    originalField.classList.add("yw-original-run-field");
    native.run.readOnly = true;
    const heading = dialog.querySelector('[slot="title"]');
    if (heading) heading.textContent = "Workspace display name";
    const content = originalField.parentElement?.parentElement;
    if (content) {
      for (const node of content.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) node.nodeValue = "";
      }
    }
    dialog.classList.add("yw-workspace-label-dialog");
    const surface = dialog.closest('[data-component="Modal"]');
    if (surface) {
      dialog.style.setProperty("--yw-editor-background", getComputedStyle(surface).backgroundColor);
      surface.classList.add("yw-workspace-label-shell");
    }
    dialog.style.setProperty("--yw-editor-left", `${Math.max(8, Math.min(rect.left, innerWidth - 368))}px`);
    dialog.style.setProperty("--yw-editor-top", `${Math.max(8, Math.min(rect.top, innerHeight - 230))}px`);
    const note = document.createElement("div");
    note.dataset.ywUi = "workspace-label-note";
    note.className = "yw-workspace-label-note";
    note.textContent = "Changes the display name in all graphs in this workspace. Enter to save · Esc to cancel.";
    dialog.append(note);
    const dialogHeight = dialog.getBoundingClientRect().height;
    dialog.style.setProperty("--yw-editor-top", `${Math.max(8, Math.min(rect.top, innerHeight - dialogHeight - 8))}px`);
    active = { dialog, cancel: native.cancel };

    // Use W&B's existing Save handler, but refuse a save if the global-name field
    // changed or if the dialog's exact fields can no longer be verified.
    function safeToSave(event) {
      const current = fields(dialog);
      if (enabled() && current && current.run.value === originalRunName) return true;
      event.preventDefault();
      event.stopImmediatePropagation();
      note.textContent = "Save blocked: the original run name must remain unchanged. Cancel and reopen the editor.";
      note.setAttribute("role", "alert");
      return false;
    }
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "keydown", "keyup"]) {
      dialog.addEventListener(type, (event) => {
        const button = event.target.closest?.("button");
        if (button?.textContent.trim() === "Save") safeToSave(event);
      }, true);
    }
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        fields(dialog)?.cancel.click();
      } else if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (safeToSave(event)) fields(dialog).save.click();
      }
    }, true);
    // Native state updates and workspace autosave remain entirely in W&B.
    native.workspace.focus();
    native.workspace.select();
  }

  async function openEditor(link) {
    if (opening || active?.dialog.isConnected) return;
    const button = nativeMenuButton(link);
    if (!button) {
      notice("Show this run in the workspace's runs table, then double-click its legend name again.");
      return;
    }
    if (Array.from(document.querySelectorAll('[role="dialog"]')).some(visible)) {
      notice("Close the open dialog before editing a workspace display name.");
      return;
    }
    opening = true;
    const rect = link.getBoundingClientRect();
    const oldItems = new Set(document.querySelectorAll('[role="menuitem"]'));
    const oldDialogs = new Set(document.querySelectorAll('[role="dialog"]'));
    try {
      button.click();
      const item = await waitFor(() => Array.from(document.querySelectorAll('[role="menuitem"][data-dd-action-name="Edit run name"]'))
        .find(item => !oldItems.has(item) && visible(item)));
      if (!enabled()) return;
      item.click();
      const dialog = await waitFor(() => Array.from(document.querySelectorAll('[role="dialog"]'))
        .find(dialog => !oldDialogs.has(dialog) && visible(dialog) && fields(dialog)));
      if (!enabled()) { fields(dialog).cancel.click(); return; }
      prepareDialog(dialog, rect);
    } catch (error) {
      for (const dialog of document.querySelectorAll('[role="dialog"]')) {
        if (!oldDialogs.has(dialog)) {
          Array.from(dialog.querySelectorAll("button")).find(button => button.textContent.trim() === "Cancel")?.click();
        }
      }
      notice(error.message);
    } finally {
      opening = false;
    }
  }

  // Defer ordinary navigation so the first click does not leave the workspace
  // before the browser can recognize the double-click.
  document.addEventListener("click", (event) => {
    const link = legendLink(event.target);
    if (!event.isTrusted || !enabled() || !link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearTimeout(clickTimer);
    if (event.detail > 1) return;
    const options = { bubbles: true, cancelable: true, view: window, detail: 1, button: 0,
      clientX: event.clientX, clientY: event.clientY };
    clickTimer = setTimeout(() => {
      if (link.isConnected && !opening && !active?.dialog.isConnected) link.dispatchEvent(new MouseEvent("click", options));
    }, 400);
  }, true);

  document.addEventListener("dblclick", (event) => {
    const link = legendLink(event.target);
    if (!enabled() || !link || !runPath(link)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearTimeout(clickTimer);
    openEditor(link);
  }, true);

  new MutationObserver(() => {
    if (!active) return;
    if (!active.dialog.isConnected) active = null;
    else if (!enabled()) active.cancel.click();
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
})();
