// ============================================================
//  AYMAN-FCA v2.0 — Emit Auth (Session End Handler)
//  © 2025 Ayman. All Rights Reserved.
//
//  يُشعر البوت بانتهاء الجلسة مع:
//  • حفظ AppState قبل الإيقاف
//  • تنظيف كامل للذاكرة
// ============================================================
"use strict";

const fs   = require("fs");
const path = require("path");

module.exports = function createEmitAuth({ logger }) {
  return function emitAuth(ctx, api, globalCallback, reason, detail) {

    // ✅ احفظ AppState قبل أي شيء
    try {
      if (api?.getAppState) {
        const state = api.getAppState();
        if (state && state.length > 0) {
          const p   = path.join(process.cwd(), "appstate.json");
          const tmp = p + ".tmp";
          fs.writeFileSync(tmp, JSON.stringify(state, null, "\t"), "utf8");
          fs.renameSync(tmp, p);
          logger("[ AYMAN ] AppState محفوظ قبل انتهاء الجلسة ✅", "info");
        }
      }
    } catch (_) {}

    // ✅ إيقاف Session Keeper
    try { if (ctx._sessionKeeper) ctx._sessionKeeper.stop(); } catch (_) {}

    // ✅ تنظيف Timers
    try { if (ctx._autoCycleTimer) { clearTimeout(ctx._autoCycleTimer);  ctx._autoCycleTimer = null; } } catch (_) {}
    try { if (ctx._reconnectTimer) { clearTimeout(ctx._reconnectTimer);  ctx._reconnectTimer = null; } } catch (_) {}
    try { if (ctx._rTimeout)       { clearTimeout(ctx._rTimeout);        ctx._rTimeout = null; }       } catch (_) {}

    try { ctx._ending = true; ctx._cycling = false; } catch (_) {}

    // ✅ إيقاف MQTT
    try {
      if (ctx.mqttClient) {
        ctx.mqttClient.removeAllListeners();
        if (ctx.mqttClient.connected) ctx.mqttClient.end(true);
      }
    } catch (_) {}
    ctx.mqttClient = undefined;
    ctx.loggedIn   = false;

    // ✅ تنظيف الذاكرة
    try { if (ctx.tasks instanceof Map) ctx.tasks.clear(); } catch (_) {}
    try {
      (ctx._autoSaveInterval || []).forEach(i => { try { clearInterval(i); } catch (_) {} });
      ctx._autoSaveInterval = [];
    } catch (_) {}
    try {
      if (ctx._scheduler?.destroy) { ctx._scheduler.destroy(); ctx._scheduler = undefined; }
    } catch (_) {}

    delete process.env.AymanFcaOnline;

    const msg = detail || reason;
    logger(`[ AYMAN ] auth → ${reason}: ${msg}`, "error");

    if (typeof globalCallback === "function") {
      try {
        globalCallback({
          type:      "account_inactive",
          reason,
          error:     msg,
          timestamp: Date.now()
        }, null);
      } catch (e) {
        logger(`[ AYMAN ] emitAuth callback خطأ: ${e?.message || e}`, "error");
      }
    }
  };
};
