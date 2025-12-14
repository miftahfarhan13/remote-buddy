// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const serviceSelect = document.getElementById("service");
  const apiKeyGroup = document.getElementById("apiKeyGroup");
  const apiKeyInput = document.getElementById("apiKey");
  const sourceLangSelect = document.getElementById("sourceLang");
  const targetLangSelect = document.getElementById("targetLang");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");

  // Load saved settings
  chrome.storage.sync.get(
    ["service", "apiKey", "sourceLang", "targetLang"],
    (items) => {
      if (items.service) serviceSelect.value = items.service;
      if (items.apiKey) apiKeyInput.value = items.apiKey;
      if (items.sourceLang) sourceLangSelect.value = items.sourceLang;
      // Default to Indonesian if not set (legacy support)
      if (items.targetLang) targetLangSelect.value = items.targetLang;

      toggleApiKeyDetail();
    }
  );

  // Toggle API Key visibility based on service
  serviceSelect.addEventListener("change", toggleApiKeyDetail);

  function toggleApiKeyDetail() {
    if (serviceSelect.value === "mock") {
      apiKeyGroup.style.display = "none";
    } else {
      apiKeyGroup.style.display = "block";
    }
  }

  // Save settings
  saveBtn.addEventListener("click", () => {
    const service = serviceSelect.value;
    const apiKey = apiKeyInput.value;
    const sourceLang = sourceLangSelect.value;
    const targetLang = targetLangSelect.value;

    chrome.storage.sync.set(
      {
        service: service,
        apiKey: apiKey,
        sourceLang: sourceLang,
        targetLang: targetLang,
      },
      () => {
        showStatus();
      }
    );
  });

  function showStatus() {
    status.classList.add("show");
    setTimeout(() => {
      status.classList.remove("show");
    }, 2000);
  }
});
