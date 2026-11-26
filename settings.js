(function (root) {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    titleFontSize: 20,
    legendFontSize: 16,
    mappings: [
      {
        from: "val/detection/maps/map_all",
        to: "Validation mAP"
      }
    ]
  });

  function normalizeSettings(value) {
    const input = value && typeof value === "object" ? value : {};
    const rawMappings = Array.isArray(input.mappings)
      ? input.mappings
      : DEFAULT_SETTINGS.mappings;

    return {
      enabled: input.enabled !== false,
      titleFontSize: clampNumber(input.titleFontSize, 12, 40, DEFAULT_SETTINGS.titleFontSize),
      legendFontSize: clampNumber(input.legendFontSize, 10, 32, DEFAULT_SETTINGS.legendFontSize),
      mappings: rawMappings
        .map((mapping) => ({
          from: typeof mapping?.from === "string" ? mapping.from.trim() : "",
          to: typeof mapping?.to === "string" ? mapping.to.trim() : ""
        }))
        .filter((mapping) => mapping.from && mapping.to)
    };
  }

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function mappingForText(text, mappings) {
    const trimmed = String(text).trim();
    const match = mappings.find((mapping) => mapping.from === trimmed);
    return match ? match.to : null;
  }

  function mappingForFragments(fragments, mappings) {
    const joined = fragments
      .map((fragment) => String(fragment).trim())
      .filter(Boolean)
      .join("");
    return mappingForText(joined, mappings);
  }

  function preserveWhitespace(original, replacement) {
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    return `${leading}${replacement}${trailing}`;
  }

  root.YassifiedWandbSettings = {
    DEFAULT_SETTINGS,
    normalizeSettings,
    mappingForText,
    mappingForFragments,
    preserveWhitespace
  };
})(typeof globalThis === "undefined" ? window : globalThis);
