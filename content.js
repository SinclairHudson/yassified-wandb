(function () {
  "use strict";

  const {
    DEFAULT_SETTINGS,
    normalizeSettings,
    mappingForText,
    mappingForFragments,
    preserveWhitespace
  } = globalThis.YassifiedWandbSettings;

  const replacements = new WeakMap();
  const splitReplacements = new Map();
  const splitTextNodes = new WeakSet();
  let settings = normalizeSettings(DEFAULT_SETTINGS);
  let observer;
  let pendingFrame = 0;

  function shouldSkip(node) {
    const parent = node.parentElement;
    return !parent || Boolean(parent.closest(
      "script, style, noscript, textarea, input, select, [contenteditable='true'], [data-yw-ui]"
    ));
  }

  function applyToTextNode(node) {
    if (shouldSkip(node) || splitTextNodes.has(node)) return;

    const current = node.nodeValue ?? "";
    const previous = replacements.get(node);
    // React may reuse an existing Text node for a different panel. If its text
    // is neither our last replacement nor its source, treat it as fresh input.
    const source = previous && (current === previous.applied || current === previous.source)
      ? previous.source
      : current;
    const replacement = settings.enabled
      ? mappingForText(source, settings.mappings)
      : null;
    const next = replacement === null
      ? source
      : preserveWhitespace(source, replacement);

    if (replacement !== null) {
      replacements.set(node, { source, applied: next });
      node.parentElement?.classList.add("yw-renamed-title");
    } else {
      replacements.delete(node);
      node.parentElement?.classList.remove("yw-renamed-title");
    }

    if (current !== next) node.nodeValue = next;
  }

  function significantTextNodes(element) {
    const nodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue?.trim() && !shouldSkip(node)) nodes.push(node);
    }
    return nodes;
  }

  function findSplitTitle(fuzzyElement) {
    let candidate = fuzzyElement.parentElement;
    for (let depth = 0; candidate && depth < 6; depth += 1, candidate = candidate.parentElement) {
      const nodes = significantTextNodes(candidate);
      const replacement = mappingForFragments(
        nodes.map((node) => node.nodeValue),
        settings.mappings
      );
      if (replacement !== null) return { element: candidate, nodes, replacement };
    }
    return null;
  }

  function applySplitTitles(root) {
    if (!settings.enabled || !root.querySelectorAll) return;

    root.querySelectorAll(".fuzzy-match").forEach((fuzzyElement) => {
      const match = findSplitTitle(fuzzyElement);
      if (!match || splitReplacements.has(match.element) || match.nodes.length < 2) return;

      const parts = match.nodes.map((node, index) => ({
        node,
        source: node.nodeValue,
        applied: index === 0
          ? preserveWhitespace(node.nodeValue, match.replacement)
          : preserveWhitespace(node.nodeValue, "")
      }));

      parts.forEach(({ node, applied }) => {
        splitTextNodes.add(node);
        node.nodeValue = applied;
      });
      match.element.classList.add("yw-renamed-title", "yw-split-renamed");
      splitReplacements.set(match.element, { parts });
    });
  }

  function reconcileSplitTitles() {
    splitReplacements.forEach((record, element) => {
      if (!element.isConnected) {
        splitReplacements.delete(element);
        return;
      }

      const allApplied = record.parts.every(({ node, applied }) =>
        node.isConnected && node.nodeValue === applied
      );
      if (!allApplied) {
        record.parts.forEach(({ node, source, applied }) => {
          if (node.isConnected && node.nodeValue === applied) node.nodeValue = source;
          splitTextNodes.delete(node);
        });
        element.classList.remove("yw-renamed-title", "yw-split-renamed");
        splitReplacements.delete(element);
      }
    });
  }

  function restoreSplitTitles() {
    splitReplacements.forEach((record, element) => {
      record.parts.forEach(({ node, source, applied }) => {
        if (node.isConnected && node.nodeValue === applied) node.nodeValue = source;
        splitTextNodes.delete(node);
      });
      element.classList.remove("yw-renamed-title", "yw-split-renamed");
    });
    splitReplacements.clear();
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      applyToTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) applyToTextNode(node);
  }

  function applyPresentationStyles() {
    const element = document.documentElement;
    element.classList.toggle("yw-enabled", settings.enabled);
    element.style.setProperty("--yw-title-size", `${settings.titleFontSize}px`);
    element.style.setProperty("--yw-legend-size", `${settings.legendFontSize}px`);
  }

  function applyAll() {
    applyPresentationStyles();
    reconcileSplitTitles();
    applySplitTitles(document.body ?? document.documentElement);
    walk(document.body ?? document.documentElement);
  }

  function scheduleApply() {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      applyAll();
    });
  }

  function observePage() {
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) =>
        mutation.type === "characterData" || mutation.addedNodes.length > 0
      )) scheduleApply();
    });
    observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    settings = normalizeSettings(stored);
    applyAll();
    observePage();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    restoreSplitTitles();
    settings = normalizeSettings({
      ...settings,
      ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value.newValue]))
    });
    scheduleApply();
  });
})();
