// ============================================================
//  AYMAN-FCA v2.0 — Cookies Helper
//  © 2025 Ayman. All Rights Reserved.
//  تحسين: حفظ cookies من www + m + messenger
// ============================================================
"use strict";

// ✅ حفظ cookies من كل response — يجدد الجلسة تلقائياً
function saveCookies(jar) {
  return res => {
    try {
      const setCookie = res?.headers?.["set-cookie"];
      if (!Array.isArray(setCookie) || !setCookie.length) return res;

      const url =
        res?.request?.res?.responseUrl ||
        (res?.config?.baseURL
          ? new URL(res.config.url || "/", res.config.baseURL).toString()
          : res?.config?.url || "https://www.facebook.com");

      for (const c of setCookie) {
        // ✅ احفظ في www و m و messenger
        for (const domain of [url, "https://www.facebook.com", "https://m.facebook.com"]) {
          try { jar.setCookieSync(c, domain); } catch (_) {}
        }
      }
    } catch (_) {}
    return res;
  };
}

// ✅ جلب AppState من كل المصادر
function getAppState(jar) {
  if (!jar || typeof jar.getCookiesSync !== "function") return [];

  const urls = [
    "https://www.facebook.com",
    "https://m.facebook.com",
    "https://www.messenger.com"
  ];

  const seen = new Set();
  const out  = [];

  for (const u of urls) {
    let cookies = [];
    try { cookies = jar.getCookiesSync(u) || []; } catch (_) { continue; }

    for (const c of cookies) {
      const key = c.key || c.name;
      if (!key) continue;
      const id = `${key}|${c.domain || ""}|${c.path || "/"}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        key,
        value:       c.value,
        domain:      c.domain || ".facebook.com",
        path:        c.path   || "/",
        hostOnly:    !!c.hostOnly,
        creation:    c.creation     || new Date(),
        lastAccessed:c.lastAccessed || new Date(),
        secure:      !!c.secure,
        httpOnly:    !!c.httpOnly,
        expires:     c.expires && c.expires !== "Infinity" ? c.expires : "Infinity"
      });
    }
  }

  return out;
}

module.exports = { saveCookies, getAppState };
