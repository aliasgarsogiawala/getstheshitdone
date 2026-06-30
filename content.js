// content.js — runs on Google Maps pages.
// Detects when you click "Save" on a place and scrapes that place's details.

(() => {
  "use strict";

  // --- Helpers to read the open place panel ---------------------------------

  // Returns the text of an element matched by selector, trimmed, or "".
  function text(el) {
    return (el && el.textContent ? el.textContent : "").trim();
  }

  // Pull a value out of an aria-label like "Address: 1 Main St" -> "1 Main St".
  function afterColon(label) {
    if (!label) return "";
    const i = label.indexOf(":");
    return (i >= 0 ? label.slice(i + 1) : label).trim();
  }

  // Find the main place details panel that is currently open.
  function getPanel() {
    // The detail pane Google uses; fall back to document if not found.
    return (
      document.querySelector('div[role="main"][aria-label]') ||
      document.querySelector('div[role="main"]') ||
      document
    );
  }

  function scrapePlace() {
    const panel = getPanel();
    const place = {
      name: "",
      category: "",
      rating: "",
      reviews: "",
      address: "",
      phone: "",
      website: "",
      plusCode: "",
      url: location.href,
      savedAt: new Date().toISOString()
    };

    // Name — the panel's H1, or the panel aria-label.
    const h1 = panel.querySelector("h1");
    place.name = text(h1) || (panel.getAttribute && panel.getAttribute("aria-label")) || "";

    // Category — button that triggers a category/search jsaction.
    const catBtn = panel.querySelector('button[jsaction*="category"]');
    place.category = text(catBtn);

    // Rating + review count (e.g. "4.6" and "(1,234)").
    const ratingEl = panel.querySelector('span[aria-hidden="true"]');
    const ratingByRole = panel.querySelector('div[role="img"][aria-label*="star" i]');
    if (ratingByRole) {
      const m = (ratingByRole.getAttribute("aria-label") || "").match(/([\d.]+)\s*star/i);
      if (m) place.rating = m[1];
    }
    if (!place.rating && ratingEl && /^[\d.]+$/.test(text(ratingEl))) {
      place.rating = text(ratingEl);
    }
    const reviewsEl = panel.querySelector('button[aria-label*="review" i], span[aria-label*="review" i]');
    if (reviewsEl) {
      const m = (reviewsEl.getAttribute("aria-label") || text(reviewsEl)).match(/([\d,]+)/);
      if (m) place.reviews = m[1].replace(/,/g, "");
    }

    // Address / Phone / Website / Plus code — these expose data-item-id or aria-labels.
    const addrBtn =
      panel.querySelector('button[data-item-id="address"]') ||
      panel.querySelector('[aria-label^="Address:" i]');
    place.address =
      afterColon(addrBtn && addrBtn.getAttribute("aria-label")) || text(addrBtn);

    const phoneBtn =
      panel.querySelector('button[data-item-id^="phone"]') ||
      panel.querySelector('[aria-label^="Phone:" i]');
    place.phone =
      afterColon(phoneBtn && phoneBtn.getAttribute("aria-label")) || text(phoneBtn);

    const siteLink =
      panel.querySelector('a[data-item-id="authority"]') ||
      panel.querySelector('a[aria-label^="Website:" i]');
    place.website =
      (siteLink && siteLink.href) ||
      afterColon(siteLink && siteLink.getAttribute("aria-label"));

    const plusBtn =
      panel.querySelector('button[data-item-id="oloc"]') ||
      panel.querySelector('[aria-label^="Plus code:" i]');
    place.plusCode =
      afterColon(plusBtn && plusBtn.getAttribute("aria-label")) || text(plusBtn);

    return place;
  }

  // --- Detect the Save action ----------------------------------------------

  // True if a clicked node (or an ancestor) is the place "Save" button.
  function findSaveButton(node) {
    let el = node;
    for (let i = 0; el && i < 6; i++) {
      if (el.getAttribute) {
        const label = (el.getAttribute("aria-label") || "").trim();
        // Match "Save" but NOT "Saved" (un-saving) and not list names.
        if (/^save\b/i.test(label) && !/^saved\b/i.test(label)) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  let lastSentKey = "";
  let lastSentAt = 0;

  function handleSaveClick() {
    // Only act when a real place is open.
    if (!/\/maps\/place\//.test(location.href)) return;

    const place = scrapePlace();
    if (!place.name) return;

    // De-dupe rapid double clicks for the same place.
    const key = place.url || place.name + place.address;
    const now = Date.now();
    if (key === lastSentKey && now - lastSentAt < 5000) return;
    lastSentKey = key;
    lastSentAt = now;

    chrome.runtime.sendMessage({ type: "SAVE_PLACE", place }, (resp) => {
      // Swallow errors if the service worker is asleep; it will still process.
      void chrome.runtime.lastError;
      if (resp && resp.ok) toast("✓ Added to your Sheet: " + place.name);
      else if (resp && resp.error) toast("⚠ Sheet error: " + resp.error);
    });
  }

  document.addEventListener(
    "click",
    (e) => {
      const btn = findSaveButton(e.target);
      if (btn) {
        // Give the panel a tick to settle, then scrape + send.
        setTimeout(handleSaveClick, 50);
      }
    },
    true // capture phase, so we see it before Maps stops propagation
  );

  // --- Tiny on-page toast ---------------------------------------------------

  function toast(msg) {
    let t = document.getElementById("__maps_sheet_toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "__maps_sheet_toast";
      t.style.cssText =
        "position:fixed;z-index:2147483647;left:50%;bottom:28px;transform:translateX(-50%);" +
        "background:#202124;color:#fff;padding:10px 16px;border-radius:8px;font:500 13px/1.4 Roboto,Arial,sans-serif;" +
        "box-shadow:0 4px 14px rgba(0,0,0,.35);max-width:80vw;transition:opacity .25s";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t.__timer);
    t.__timer = setTimeout(() => (t.style.opacity = "0"), 3000);
  }
})();
