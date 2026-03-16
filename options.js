const element = document.getElementById("keywords");
const statusDiv = document.getElementById("status");
let saveTimeout;
let statusTimeout;

const storage = browser.storage.sync || browser.storage.local;
const validPattern = /^[a-zA-Z0-9.-]+$/;

function parseKeywords(rawValue) {
  return rawValue.split(",").map((part) => part.trim()).filter(Boolean);
}

storage.get("keywords").then((res) => {
  element.value = res.keywords || "";
}).catch((error) => {
  showStatus(`Failed to load keywords: ${error.message}`, true);
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
        showStatus("Saved.", false);
      }).catch((error) => {
        showStatus(`Error saving: ${error.message}`, true);
      });
    }, 500);
  } else {
    element.classList.add("invalid");
    showStatus("Invalid characters. Only alphanumeric, '.' and '-' are allowed.", true);
  }
});

function showStatus(text, isError) {
  clearTimeout(statusTimeout);
  statusDiv.textContent = text;
  statusDiv.classList.toggle("error", isError);
  statusDiv.classList.add("visible");
  
  if (!isError) {
    statusTimeout = setTimeout(() => {
      statusDiv.classList.remove("visible");
    }, 2000);
  }
}
