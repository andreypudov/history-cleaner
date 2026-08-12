const _browser = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
const storage = _browser && _browser.storage ? (_browser.storage.sync || _browser.storage.local) : null;
const CLEANUP_ALARM_NAME = "historyCleanup";
const CLEANUP_PERIOD_MINUTES = 16;
const HISTORY_SEARCH_MAX_RESULTS = 10000;

let cleanupInProgress = false;

function parseKeywords(rawKeywords = "") {
  return [...new Set(
    String(rawKeywords)
      .split(",")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean)
  )];
}

async function getKeywords() {
  if (!storage || typeof storage.get !== 'function') {
    console.warn('Storage API unavailable; no keywords loaded.');
    return [];
  }

  try {
    const result = await storage.get("keywords");
    return parseKeywords(result && result.keywords ? result.keywords : "");
  } catch (error) {
    console.error("Failed to load history cleaner keywords.", error);
    return [];
  }
}

// Helper: run async functions in batches to avoid overwhelming the API
async function runInBatches(items, worker, batchSize = 20) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((it) => worker(it)));
  }
}

async function cleanupHistory() {
  if (cleanupInProgress) {
    return;
  }

  cleanupInProgress = true;

  try {
    const keywords = await getKeywords();

    if (!keywords || keywords.length === 0) {
      return;
    }

    const urlsToDelete = new Set();

    for (const keyword of keywords) {
      try {
        const results = await _browser.history.search({
          text: keyword,
          startTime: 0,
          maxResults: HISTORY_SEARCH_MAX_RESULTS
        });

        for (const item of results || []) {
          if (!item || !item.url) continue;

          const searchableText = `${item.url} ${item.title || ""}`.toLowerCase();

          if (searchableText.includes(keyword)) {
            urlsToDelete.add(item.url);
          }
        }
      } catch (err) {
        console.warn(`Search failed for keyword "${keyword}":`, err);
        // continue with other keywords
      }
    }

    const urls = Array.from(urlsToDelete);

    await runInBatches(urls, async (url) => {
      try {
        await _browser.history.deleteUrl({ url });
      } catch (err) {
        console.warn('Failed to delete URL', url, err);
      }
    }, 10);
  } catch (error) {
    console.error("History cleanup failed.", error);
  } finally {
    cleanupInProgress = false;
  }
}

// Create alarm/listener only if alarms API is available
if (_browser && _browser.alarms && typeof _browser.alarms.create === 'function') {
  try {
    _browser.alarms.create(CLEANUP_ALARM_NAME, {
      periodInMinutes: CLEANUP_PERIOD_MINUTES
    });

    _browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm && alarm.name === CLEANUP_ALARM_NAME) {
        cleanupHistory();
      }
    });
  } catch (err) {
    console.warn('Failed to initialize alarms API', err);
  }
}

// Run an initial cleanup but don't block startup
try {
  cleanupHistory();
} catch (e) {
  console.warn('Initial cleanup invocation failed', e);
}
