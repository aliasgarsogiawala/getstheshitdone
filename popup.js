const $ = (id) => document.getElementById(id);

function setStatus(msg, ok) {
  const el = $("status");
  el.textContent = msg;
  el.className = ok === undefined ? "" : ok ? "ok" : "err";
}

async function load() {
  const sync = await chrome.storage.sync.get(["webAppUrl", "enabled"]);
  const local = await chrome.storage.local.get(["savedCount", "lastPlace", "sheetUrl"]);
  $("url").value = sync.webAppUrl || "";
  $("enabled").checked = sync.enabled !== false; // default on
  $("count").textContent = local.savedCount || 0;
  $("last").textContent = local.lastPlace || "—";
  if (local.sheetUrl) {
    const a = $("sheet");
    a.href = local.sheetUrl;
    a.style.display = "inline";
  }
}

$("save").addEventListener("click", async () => {
  const url = $("url").value.trim();
  if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(url)) {
    setStatus("That doesn't look like a Web App /exec URL.", false);
    return;
  }
  await chrome.storage.sync.set({ webAppUrl: url, enabled: $("enabled").checked });
  setStatus("Saved.", true);
});

$("enabled").addEventListener("change", async () => {
  await chrome.storage.sync.set({ enabled: $("enabled").checked });
});

$("test").addEventListener("click", async () => {
  const url = $("url").value.trim();
  if (!url) return setStatus("Enter your Web App URL first.", false);
  setStatus("Sending a test row…");
  const testPlace = {
    name: "TEST — " + new Date().toLocaleString(),
    category: "Test",
    address: "123 Test St",
    phone: "",
    website: "https://example.com",
    rating: "",
    reviews: "",
    plusCode: "",
    url: "https://www.google.com/maps",
    savedAt: new Date().toISOString()
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(testPlace)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok !== false) {
      setStatus("✓ Test row added. Check your Sheet.", true);
      if (data.sheetUrl) {
        await chrome.storage.local.set({ sheetUrl: data.sheetUrl });
        const a = $("sheet");
        a.href = data.sheetUrl;
        a.style.display = "inline";
      }
    } else {
      setStatus("Failed: " + (data.error || "HTTP " + res.status), false);
    }
  } catch (e) {
    setStatus("Failed: " + e.message, false);
  }
});

load();
