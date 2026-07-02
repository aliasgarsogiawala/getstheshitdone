# Maps → Sheet Saver

A Chrome extension that watches Google Maps and, whenever you **Save** a company/place,
automatically appends its details (name, category, rating, address, phone, website, Maps link)
to a Google Sheet. The Sheet is **created for you** on the first save.

## How it works

```
Google Maps page ──click "Save"──▶ content.js scrapes the place
        │
        ▼
background.js  ──POST JSON──▶  Google Apps Script Web App  ──▶  Google Sheet (auto-created)
```

Google Maps has no public "I saved a place" API, so the extension detects the Save click on
the page itself and reads the open place panel.

---

## Setup (one time, ~2 minutes)

### 1. Deploy the backend (creates your Sheet)

1. Go to <https://script.google.com> → **New project**.
2. Delete the sample code, paste everything from `apps-script/Code.gs`, and **Save**.
3. Click **Deploy ▸ New deployment** → gear icon ▸ **Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, authorize when prompted, and **copy the Web app URL**
   (it ends in `/exec`).

### 2. Load the extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (`getstheshitdone`).

### 3. Connect them

1. Click the extension icon → paste the **/exec URL** → **Save settings**.
2. (Optional) Paste a link to an existing Google Sheet into **Append to this Sheet** if you
   want rows added there instead of a new spreadsheet. Leave it blank and one is created for you.
3. Click **Test** — a `TEST —` row should appear and the **Open your Sheet ↗** link lights up.

---

## Daily use

Browse Google Maps, open a company, click **Save** (any list — Favorites, Want to go, etc.).
A toast confirms `✓ Added to your Sheet`, and the row appears in your spreadsheet.
Duplicate places (same Maps URL) are skipped automatically.

## Notes & limits

- The Save detector and scraper rely on Google Maps' current DOM. If Google changes their
  markup, selectors in `content.js` (`findSaveButton`, `scrapePlace`) may need a tweak.
- Some fields (phone, website) only fill in if they're shown on the place panel.
- The target Sheet (if set) must be owned by or shared (edit access) with the account the
  Web App is deployed as ("Execute as: Me"), otherwise appends will fail.
- Everything stays between your browser and *your* Google account — no third-party server.

## Files

| File | Role |
|------|------|
| `manifest.json` | Extension manifest (MV3) |
| `content.js` | Detects the Save click + scrapes the place |
| `background.js` | Sends the place to your Web App |
| `popup.html` / `popup.js` | Settings + Test + counters |
| `apps-script/Code.gs` | Web App that creates the Sheet and appends rows |
