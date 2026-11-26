const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("loaded extension scripts cannot rename the underlying W&B run", () => {
  const root = path.join(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  for (const script of manifest.content_scripts.flatMap((entry) => entry.js)) {
    const source = fs.readFileSync(path.join(root, script), "utf8");
    assert.doesNotMatch(source, /upsertBucket|YwRenameRun|renameRun/, `${script} must not contain a run rename mutation`);
  }
});
