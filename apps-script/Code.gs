/**
 * Maps → Sheet Saver — backend.
 * Paste this into a Google Apps Script project, deploy as a Web App
 * ("Execute as: User accessing the web app", "Who has access: Anyone"),
 * and put the /exec URL into the Chrome extension popup.
 *
 * Deploying with "Execute as: User accessing the web app" means the script
 * runs with each caller's own Google permissions — so a single shared
 * deployment lets anyone with editor access to a target Sheet append to it,
 * not just whoever deployed the script. Each user must open the /exec URL
 * once in a browser to grant it permission before calling it from the
 * extension.
 *
 * If the request includes a targetSheetUrl (set via the popup's optional
 * "Append to this Sheet" field), rows are appended there. Otherwise, on
 * the first save it auto-creates a spreadsheet named below (owned by that
 * caller) and remembers its ID for them, so no one has to create a Sheet
 * themselves.
 */

var SHEET_NAME = "Shortlisted Companies";
var HEADERS = [
  "Saved At",
  "Name",
  "Category",
  "Rating",
  "Reviews",
  "Address",
  "Phone",
  "Website",
  "Plus Code",
  "Maps URL"
];

function doPost(e) {
  try {
    var place = JSON.parse(e.postData.contents);
    var sheet = getSheet_(place.targetSheetUrl);

    // De-dupe: skip if this Maps URL (or name+address) is already a row.
    if (isDuplicate_(sheet, place)) {
      return json_({ ok: true, duplicate: true, sheetUrl: sheet.getParent().getUrl() });
    }

    sheet.appendRow([
      place.savedAt || new Date().toISOString(),
      place.name || "",
      place.category || "",
      place.rating || "",
      place.reviews || "",
      place.address || "",
      place.phone || "",
      place.website || "",
      place.plusCode || "",
      place.url || ""
    ]);

    return json_({ ok: true, sheetUrl: sheet.getParent().getUrl() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  // Lets you sanity-check the deployment in a browser.
  var sheet = getSheet_();
  return json_({ ok: true, sheetUrl: sheet.getParent().getUrl() });
}

function getSheet_(targetSheetUrl) {
  // Scoped to the calling user (not the deployer), since the script runs
  // as "User accessing the web app" — each caller gets their own fallback Sheet.
  var props = PropertiesService.getUserProperties();
  var ss;

  if (targetSheetUrl) {
    // Caller gave us a Sheet to append to — use it directly, every time.
    // This succeeds as long as the calling user has editor access to it.
    var id = extractSpreadsheetId_(targetSheetUrl);
    if (!id) throw new Error("That doesn't look like a Google Sheets link.");
    ss = SpreadsheetApp.openById(id);
  } else {
    // No Sheet given — reuse the one we auto-created before for this user, or make a new one.
    var storedId = props.getProperty("SPREADSHEET_ID");
    if (storedId) {
      try {
        ss = SpreadsheetApp.openById(storedId);
      } catch (e) {
        ss = null; // sheet was deleted — recreate below
      }
    }
    if (!ss) {
      ss = SpreadsheetApp.create(SHEET_NAME);
      props.setProperty("SPREADSHEET_ID", ss.getId());
    }
  }

  var sheet = ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Pulls the spreadsheet ID out of a full Sheets URL, or passes through a bare ID.
function extractSpreadsheetId_(urlOrId) {
  var s = String(urlOrId).trim();
  var m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s; // looks like a bare spreadsheet ID
  return null;
}

function isDuplicate_(sheet, place) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var url = (place.url || "").trim();
  var key = ((place.name || "") + "|" + (place.address || "")).trim().toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    var rowUrl = String(rows[i][9] || "").trim();
    var rowKey = (String(rows[i][1] || "") + "|" + String(rows[i][5] || ""))
      .trim()
      .toLowerCase();
    if ((url && rowUrl && rowUrl === url) || (key !== "|" && rowKey === key)) {
      return true;
    }
  }
  return false;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
