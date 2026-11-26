(function () {
  "use strict";

  const { DEFAULT_SETTINGS, normalizeSettings } = globalThis.YassifiedWandbSettings;
  const enabledInput = document.querySelector("#enabled");
  const titleSizeInput = document.querySelector("#title-size");
  const legendSizeInput = document.querySelector("#legend-size");
  const mappingsElement = document.querySelector("#mappings");
  const template = document.querySelector("#mapping-template");
  const status = document.querySelector("#status");

  function addMapping(mapping = { from: "", to: "" }) {
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector(".mapping-from").value = mapping.from;
    row.querySelector(".mapping-to").value = mapping.to;
    row.querySelector(".remove").addEventListener("click", () => row.remove());
    mappingsElement.append(row);
  }

  function render(stored) {
    const settings = normalizeSettings(stored);
    enabledInput.checked = settings.enabled;
    titleSizeInput.value = settings.titleFontSize;
    legendSizeInput.value = settings.legendFontSize;
    mappingsElement.replaceChildren();
    settings.mappings.forEach(addMapping);
    if (!settings.mappings.length) addMapping();
  }

  function collect() {
    return normalizeSettings({
      enabled: enabledInput.checked,
      titleFontSize: titleSizeInput.value,
      legendFontSize: legendSizeInput.value,
      mappings: [...mappingsElement.querySelectorAll(".mapping-row")].map((row) => ({
        from: row.querySelector(".mapping-from").value,
        to: row.querySelector(".mapping-to").value
      }))
    });
  }

  document.querySelector("#add-mapping").addEventListener("click", () => addMapping());
  document.querySelector("#save").addEventListener("click", () => {
    chrome.storage.sync.set(collect(), () => {
      status.textContent = "Saved — W&B updates live";
      window.setTimeout(() => { status.textContent = ""; }, 2200);
    });
  });

  chrome.storage.sync.get(DEFAULT_SETTINGS, render);
})();
