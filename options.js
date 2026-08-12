(function () {
  const _browser = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  const storage = _browser && _browser.storage ? (_browser.storage.sync || _browser.storage.local) : null;
  const validPattern = /^[a-zA-Z0-9.-]+$/;

  function parseKeywords(rawValue) {
    return String(rawValue || "").split(",").map((part) => part.trim()).filter(Boolean);
  }

  function showStatus(statusDiv, text, isError) {
    if (!statusDiv) return;
    clearTimeout(statusDiv._timeout);
    statusDiv.textContent = text;
    statusDiv.classList.toggle("error", !!isError);
    statusDiv.classList.add("visible");

    if (!isError) {
      statusDiv._timeout = setTimeout(() => {
        statusDiv.classList.remove("visible");
      }, 2000);
    }
  }

  function init() {
    const element = document.getElementById("keywords");
    const statusDiv = document.getElementById("status");
    let saveTimeout;

    if (!element || !statusDiv) {
      console.warn('Options UI elements not found.');
      return;
    }

    if (!storage || typeof storage.get !== 'function') {
      showStatus(statusDiv, 'Storage API unavailable in this environment.', true);
      return;
    }

    storage.get("keywords").then((res) => {
      element.value = res && res.keywords ? res.keywords : "";
    }).catch((error) => {
      showStatus(statusDiv, `Failed to load keywords: ${error && error.message ? error.message : error}`, true);
    });

    element.addEventListener("input", () => {
      clearTimeout(saveTimeout);

      const rawValue = element.value;
      const parts = parseKeywords(rawValue);
      const isValid = parts.every((part) => validPattern.test(part));

      if (isValid) {
        element.classList.remove("invalid");
        saveTimeout = setTimeout(() => {
          storage.set({ keywords: rawValue }).then(() => {
            showStatus(statusDiv, "Saved.", false);
          }).catch((error) => {
            showStatus(statusDiv, `Error saving: ${error && error.message ? error.message : error}`, true);
          });
        }, 500);
      } else {
        element.classList.add("invalid");
        showStatus(statusDiv, "Invalid characters. Only alphanumeric, '.' and '-' are allowed.", true);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
