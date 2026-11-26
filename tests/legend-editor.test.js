const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

function setup({ listed = true } = {}) {
  const dom = new JSDOM(`<html class="yw-enabled"><body>
    <div class="wb-tree-cell--header-row"><a href="/wandb/team/project/runs/other">Same label</a><button aria-label="Show run menu">Menu</button></div>
    ${listed ? '<div class="wb-tree-cell--header-row"><a href="/wandb/team/project/runs/abc?nw=my-workspace">Same label</a><button id="target-menu" aria-label="Show run menu">Menu</button></div>' : ''}
    <div data-test="line-plot-legend-run-name"><a id="legend" href="/wandb/team/project/runs/abc"><div aria-label="Same label"><div class="textStart">Same label</div><div class="textEnd">Same label</div></div></a></div>
  </body></html>`, { url: "https://forge.coreweave.com/wandb/team/project/workspace?nw=my-workspace", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const observers = [];
  const Observer = w.MutationObserver;
  w.MutationObserver = class extends Observer {
    constructor(callback) { super(callback); observers.push(this); }
  };
  w.Element.prototype.getClientRects = function () { return this.isConnected ? [{ width: 100 }] : []; };
  w.fetch = () => assert.fail("The legend editor must not make API requests");
  w.XMLHttpRequest = class { constructor() { assert.fail("The legend editor must not make API requests"); } };
  let saved;
  let saves = 0;
  let openedRun;
  for (const button of w.document.querySelectorAll('button[aria-label="Show run menu"]')) {
    button.addEventListener("click", () => {
      openedRun = button.previousElementSibling.href;
      const item = w.document.createElement("div");
      item.setAttribute("role", "menuitem");
      item.dataset.ddActionName = "Edit run name";
      item.textContent = "Edit run name";
      item.addEventListener("click", () => {
        item.remove();
        const dialog = w.document.createElement("section");
        dialog.setAttribute("role", "dialog");
        dialog.innerHTML = `<h2 slot="title">Edit run name</h2><section><div>Edit the run name for the entire project, or add a display name for this workspace only.<div>
          <div data-component="TextField"><label for="run-input">Run name</label><input id="run-input" type="text" value="Original global name"></div>
          <div data-component="TextField"><label for="workspace-input">Display name (this workspace)</label><input id="workspace-input" type="text" value="Existing workspace alias"></div>
        </div></div></section><footer><button id="save">Save</button><button id="cancel">Cancel</button></footer>`;
        dialog.querySelector("#save").addEventListener("click", () => {
          saves += 1;
          saved = { run: dialog.querySelector("#run-input").value, workspace: dialog.querySelector("#workspace-input").value };
          dialog.remove();
        });
        dialog.querySelector("#cancel").addEventListener("click", () => dialog.remove());
        w.document.body.append(dialog);
      });
      w.document.body.append(item);
    });
  }
  w.eval(fs.readFileSync(path.join(__dirname, "../legend-editor.js"), "utf8"));
  return { w, get saved() { return saved; }, get saves() { return saves; }, get openedRun() { return openedRun; },
    async open() { w.document.querySelector(".textEnd").dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true, cancelable: true })); await tick(); },
    close() { observers.forEach(observer => observer.disconnect()); w.close(); } };
}

test("double-click targets the linked run and selects only its workspace display name", async () => {
  const x = setup();
  try {
    await x.open();
    assert.match(x.openedRun, /\/runs\/abc\?/);
    const input = x.w.document.querySelector("#workspace-input");
    assert.equal(x.w.document.activeElement, input);
    assert.equal(input.selectionStart, 0);
    assert.equal(input.selectionEnd, input.value.length);
    assert.equal(x.w.document.querySelector("#run-input").readOnly, true);
    assert.ok(x.w.document.querySelector("#run-input").closest(".yw-original-run-field"));
    input.value = "New workspace alias";
    input.dispatchEvent(new x.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert.deepEqual(x.saved, { run: "Original global name", workspace: "New workspace alias" });
    assert.equal(x.saves, 1);
  } finally { x.close(); }
});

test("Escape cancels and clearing the workspace field uses W&B's native reset", async () => {
  const x = setup();
  try {
    await x.open();
    x.w.document.querySelector("#workspace-input").dispatchEvent(new x.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert.equal(x.saves, 0);
    await x.open();
    const input = x.w.document.querySelector("#workspace-input");
    input.value = "";
    input.dispatchEvent(new x.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert.deepEqual(x.saved, { run: "Original global name", workspace: "" });
  } finally { x.close(); }
});

test("both Save and Enter are blocked if the original run name changes", async () => {
  const x = setup();
  try {
    await x.open();
    x.w.document.querySelector("#run-input").value = "Accidental global rename";
    const save = x.w.document.querySelector("#save");
    let nativePresses = 0;
    save.addEventListener("pointerup", () => nativePresses++);
    save.addEventListener("keydown", () => nativePresses++);
    save.dispatchEvent(new x.w.MouseEvent("pointerup", { bubbles: true, cancelable: true }));
    save.dispatchEvent(new x.w.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    save.click();
    x.w.document.querySelector("#workspace-input").dispatchEvent(new x.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert.equal(x.saves, 0);
    assert.equal(nativePresses, 0);
    assert.match(x.w.document.querySelector('[data-yw-ui="workspace-label-note"]').textContent, /Save blocked/);
  } finally { x.close(); }
});

test("missing workspace field blocks saving instead of falling back to the run name", async () => {
  const x = setup();
  try {
    await x.open();
    x.w.document.querySelector('label[for="workspace-input"]').textContent = "Some other field";
    x.w.document.querySelector("#save").click();
    assert.equal(x.saves, 0);
  } finally { x.close(); }
});

test("a run missing from the table does not open another run with the same label", async () => {
  const x = setup({ listed: false });
  try {
    await x.open();
    assert.equal(x.openedRun, undefined);
    assert.equal(x.w.document.querySelector('[role="dialog"]'), null);
    assert.match(x.w.document.querySelector('[role="alert"]').textContent, /runs table/);
    assert.equal(x.saves, 0);
  } finally { x.close(); }
});

test("disabling the extension cancels an unsaved workspace edit", async () => {
  const x = setup();
  try {
    await x.open();
    x.w.document.documentElement.classList.remove("yw-enabled");
    await tick();
    assert.equal(x.w.document.querySelector('[role="dialog"]'), null);
    assert.equal(x.saves, 0);
  } finally { x.close(); }
});
