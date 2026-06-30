/**
 * Maps → Sheet Saver — backend.
 * Paste this into a Google Apps Script project, deploy as a Web App
 * ("Execute as: Me", "Who has access: Anyone"), and put the /exec URL
 * into the Chrome extension popup.
 *
 * On the first save it auto-creates a spreadsheet named below and
 * remembers its ID, so you never have to create the Sheet yourself.
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
    var sheet = getSheet_();

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

function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SPREADSHEET_ID");
  var ss;

  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      ss = null; // sheet was deleted — recreate below
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty("SPREADSHEET_ID", ss.getId());
  }

  var sheet = ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
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
