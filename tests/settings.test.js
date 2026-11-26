const assert = require("node:assert/strict");
const test = require("node:test");

require("../settings.js");

const {
  normalizeSettings,
  mappingForText,
  mappingForFragments,
  preserveWhitespace
} = globalThis.YassifiedWandbSettings;

test("normalizes mappings and clamps font sizes", () => {
  assert.deepEqual(normalizeSettings({
    enabled: false,
    titleFontSize: 99,
    legendFontSize: 2,
    mappings: [{ from: " old ", to: " New " }, { from: "", to: "ignored" }]
  }), {
    enabled: false,
    titleFontSize: 40,
    legendFontSize: 10,
    mappings: [{ from: "old", to: "New" }]
  });
});

test("matches titles exactly after trimming outer whitespace", () => {
  const mappings = [{ from: "val/metric", to: "Validation metric" }];
  assert.equal(mappingForText("  val/metric\n", mappings), "Validation metric");
  assert.equal(mappingForText("prefix val/metric", mappings), null);
});

test("matches a title split around W&B's fuzzy search highlight", () => {
  const mappings = [{
    from: "val/detection/maps/map_all",
    to: "Validation mAP"
  }];
  assert.equal(mappingForFragments([
    "val/detection/maps/",
    "map_all"
  ], mappings), "Validation mAP");
});

test("preserves surrounding whitespace when replacing", () => {
  assert.equal(preserveWhitespace("  old\n", "New"), "  New\n");
});
