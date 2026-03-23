// ============================================================
//  AYMAN-FCA v2.0 — Header Sanitizer
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

function sanitizeHeaderValue(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // ✅ إزالة كل الأحرف غير الصالحة في HTTP headers
  return str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F\r\n]/g, "").trim();
}

function sanitizeHeaderName(name) {
  if (!name || typeof name !== "string") return "";
  return name.replace(/[^\x21-\x7E]/g, "").trim();
}

function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    const k = sanitizeHeaderName(key);
    if (!k) continue;
    if (Array.isArray(value) || (value !== null && typeof value === "object") || typeof value === "function") continue;

    // ✅ كشف القيم المسلسلة كـ array خطأً
    if (typeof value === "string") {
      const t = value.trim();
      if (t.startsWith("[") && t.endsWith("]")) {
        try { if (Array.isArray(JSON.parse(t))) continue; } catch (_) {}
      }
    }

    const v = sanitizeHeaderValue(value);
    if (v !== "") out[k] = v;
  }
  return out;
}

module.exports = { sanitizeHeaderValue, sanitizeHeaderName, sanitizeHeaders };
