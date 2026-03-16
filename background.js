const storage = browser.storage.sync || browser.storage.local;
const CLEANUP_ALARM_NAME = "historyCleanup";
const CLEANUP_PERIOD_MINUTES = 16;
const HISTORY_SEARCH_MAX_RESULTS = 10000;

let cleanupInProgress = false;

function parseKeywords(rawKeywords = "") {
  return [...new Set(
    rawKeywords
      .split(",")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean)
  )];
}

async function getKeywords() {
  try {
    const result = await storage.get("keywords");
    return parseKeywords(result.keywords || "");
  } catch (error) {
    console.error("Failed to load history cleaner keywords.", error);
    return [];
  }
}

async function cleanupHistory() {
  if (cleanupInProgress) {
    return;
  }

  cleanupInProgress = true;

  try {
    const keywords = await getKeywords();

    if (keywords.length === 0) {
      return;
    }

    const urlsToDelete = new Set();

    for (const keyword of keywords) {
      const results = await browser.history.search({
        text: keyword,
        startTime: 0,
        maxResults: HISTORY_SEARCH_MAX_RESULTS
      });

      for (const item of results) {
        if (!item.url) {
          continue;
        }

        const searchableText = `${item.url} ${item.title || ""}`.toLowerCase();

        if (searchableText.includes(keyword)) {
          urlsToDelete.add(item.url);
        }
      }
    }

    for (const url of urlsToDelete) {
      await browser.history.deleteUrl({ url });
    }
  } catch (error) {
    console.error("History cleanup failed.", error);
  } finally {
    cleanupInProgress = false;
  }
}

browser.alarms.create(CLEANUP_ALARM_NAME, {
  periodInMinutes: CLEANUP_PERIOD_MINUTES
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CLEANUP_ALARM_NAME) {
    cleanupHistory();
  }
});

cleanupHistory();