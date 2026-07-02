// background.js — service worker. Forwards scraped places to your Apps Script Web App.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "SAVE_PLACE") {
    handleSave(msg.place).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
});

async function handleSave(place) {
  const { webAppUrl, enabled = true, targetSheetUrl = "" } = await chrome.storage.sync.get([
    "webAppUrl",
    "enabled",
    "targetSheetUrl"
  ]);

  if (!enabled) return { ok: false, error: "Saving is turned off" };
  if (!webAppUrl) return { ok: false, error: "Set your Web App URL in the popup first" };

  try {
    const res = await fetch(webAppUrl, {
      method: "POST",
      // text/plain avoids a CORS preflight; Apps Script reads e.postData.contents.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...place, targetSheetUrl })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      return { ok: false, error: (data && data.error) || ("HTTP " + res.status) };
    }

    // Track count + last sheet URL for the popup.
    const { savedCount = 0 } = await chrome.storage.local.get("savedCount");
    const isFirstSave = savedCount === 0;
    await chrome.storage.local.set({
      savedCount: savedCount + 1,
      lastPlace: place.name,
      sheetUrl: data.sheetUrl || (await chrome.storage.local.get("sheetUrl")).sheetUrl
    });

    // Land the user straight on the newly-created Sheet the first time.
    if (isFirstSave && data.sheetUrl) {
      chrome.tabs.create({ url: data.sheetUrl });
    }

    return { ok: true, sheetUrl: data.sheetUrl, isFirstSave };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}
