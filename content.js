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

  // Labels Maps puts on ads that must never be treated as a company name.
  const AD_LABELS = /^(sponsored|ad|advertisement|results)$/i;

  // Clean a candidate name: drop leading "Sponsored"/"Ad" badge lines,
  // return "" if what remains is itself just an ad label.
  function cleanName(raw) {
    if (!raw) return "";
    // The name node often reads "Sponsored\nReal Company" — keep the real part.
    const parts = raw
      .split(/[\n\r]+/)
      .map((s) => s.trim())
      .filter((s) => s && !AD_LABELS.test(s));
    let name = parts.length ? parts[parts.length - 1] : raw.trim();
    // Strip an inline "Sponsored · " / "Ad · " prefix if present.
    name = name.replace(/^\s*(sponsored|ad|advertisement)\b[\s·:–-]*/i, "").trim();
    if (AD_LABELS.test(name)) return "";
    return name;
  }

  // Best-effort company name: try the panel aria-label and every H1,
  // skipping anything that is just an ad badge.
  function getName(panel) {
    const candidates = [];
    if (panel.getAttribute) candidates.push(panel.getAttribute("aria-label"));
    panel.querySelectorAll("h1").forEach((h) => candidates.push(text(h)));
    for (const c of candidates) {
      const name = cleanName(c);
      if (name) return name;
    }
    return "";
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

  // From the Save button, find the tightest place container it belongs to —
  // a search-results card if that's where the click came from, otherwise the
  // detail panel. This is what makes "save from the list" scrape correctly.
  function getScope(btn) {
    let el = btn;
    for (let i = 0; el && i < 12; i++) {
      if (el.getAttribute) {
        const role = el.getAttribute("role");
        if (role === "article") return el; // a results-list card
      }
      // A container that holds a place link is a good card boundary.
      if (
        el.querySelector &&
        el.querySelector('a[href*="/maps/place/"]') &&
        el.querySelector('button[aria-label^="Save" i], button[jsaction*="save" i]')
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return getPanel();
  }

  function scrapePlace(scope) {
    const panel = scope || getPanel();

    // A place link inside a card gives us the real name + URL for that place.
    const placeLink = panel.querySelector('a[href*="/maps/place/"]');

    const place = {
      name: "",
      category: "",
      rating: "",
      reviews: "",
      address: "",
      phone: "",
      website: "",
      plusCode: "",
      url: (placeLink && placeLink.href) || location.href,
      savedAt: new Date().toISOString()
    };

    // Name — first non-ad candidate from the card link, panel aria-label, or H1s.
    place.name =
      cleanName(placeLink && placeLink.getAttribute("aria-label")) || getName(panel);

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

  function handleSaveClick(btn) {
    const scope = getScope(btn);

    // Act when a place is open OR when we saved from a card that links to one.
    const onPlace = /\/maps\/place\//.test(location.href);
    const cardHasPlace =
      scope && scope.querySelector && scope.querySelector('a[href*="/maps/place/"]');
    if (!onPlace && !cardHasPlace) return;

    const place = scrapePlace(scope);
    if (!place.name || AD_LABELS.test(place.name)) return;

    // De-dupe rapid double clicks for the same place.
    const key = place.url || place.name + place.address;
    const now = Date.now();
    if (key === lastSentKey && now - lastSentAt < 5000) return;
    lastSentKey = key;
    lastSentAt = now;

    chrome.runtime.sendMessage({ type: "SAVE_PLACE", place }, (resp) => {
      // Swallow errors if the service worker is asleep; it will still process.
      void chrome.runtime.lastError;
      if (resp && resp.ok) {
        const msg = resp.isFirstSave
          ? "✓ Your Sheet is ready — opening it now"
          : "✓ Added to your Sheet: " + place.name;
        toast(msg, resp.sheetUrl);
      } else if (resp && resp.error) {
        toast("⚠ Sheet error: " + resp.error);
      }
    });
  }

  document.addEventListener(
    "click",
    (e) => {
      const btn = findSaveButton(e.target);
      if (btn) {
        // Give the panel a tick to settle, then scrape + send.
        setTimeout(() => handleSaveClick(btn), 50);
      }
    },
    true // capture phase, so we see it before Maps stops propagation
  );

  // --- Tiny on-page toast ---------------------------------------------------

  function toast(msg, sheetUrl) {
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
    t.textContent = msg + " ";
    if (sheetUrl) {
      const link = document.createElement("a");
      link.href = sheetUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Open Sheet ↗";
      link.style.cssText = "color:#8ab4f8;text-decoration:underline;margin-left:4px;";
      t.appendChild(link);
    }
    t.style.opacity = "1";
    clearTimeout(t.__timer);
    t.__timer = setTimeout(() => (t.style.opacity = "0"), 3000);
  }
})();
