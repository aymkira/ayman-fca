// ============================================================
//  AYMAN-FCA v2.0 — Smart Broadcast
//  © 2025 Ayman. All Rights Reserved.
//
//  إرسال رسالة لقائمة threads مع:
//  • Rate limiting ذكي
//  • Retry تلقائي لكل thread
//  • تقرير نتائج مفصل
//
//  api.broadcast(threadIDs, message, options?)
// ============================================================
"use strict";

const logger = require("../../func/logger");
const delay  = ms => new Promise(r => setTimeout(r, ms));

async function broadcast(api, threadIDs, message, options = {}) {
  const {
    delayMs  = 1200,
    retries  = 2,
    onResult = null
  } = options;

  if (!api?.sendMessage) throw new Error("AYMAN-FCA: api.sendMessage مطلوب");

  const ids     = Array.isArray(threadIDs) ? threadIDs : [threadIDs];
  const results = [];
  let sent = 0, failed = 0;

  for (const id of ids) {
    let ok = false, lastErr;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await api.sendMessage(message, id);
        results.push({ threadID: id, ok: true, res });
        if (onResult) onResult(null, { threadID: id, ok: true });
        ok = true;
        sent++;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) await delay(1500);
      }
    }

    if (!ok) {
      const errMsg = lastErr?.error || lastErr?.message || String(lastErr);
      logger(`[ AYMAN ] broadcast فشل لـ ${id}: ${errMsg}`, "warn");
      results.push({ threadID: id, ok: false, error: lastErr });
      if (onResult) onResult(lastErr, { threadID: id, ok: false });
      failed++;
    }

    if (delayMs > 0) await delay(delayMs);
  }

  logger(`[ AYMAN ] broadcast: ${sent} نجح، ${failed} فشل`, "info");
  return { results, sent, failed, total: ids.length };
}

module.exports = broadcast;
