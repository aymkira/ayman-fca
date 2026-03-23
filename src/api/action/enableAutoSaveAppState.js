// ============================================================
//  AYMAN-FCA v2.0 — Auto Save AppState
//  © 2025 Ayman. All Rights Reserved.
//
//  حفظ ذكي: لا يحفظ إذا لم تتغير البيانات
//  Atomic write: يحمي الملف من التلف
//  يحفظ عند SIGINT/SIGTERM
// ============================================================
"use strict";

const fs   = require("fs");
const path = require("path");
const logger = require("../../../func/logger");

module.exports = function(defaultFuncs, api, ctx) {
  return function enableAutoSaveAppState(options = {}) {
    const filePath   = options.filePath || path.join(process.cwd(), "appstate.json");
    const intervalMs = options.interval || 8 * 60 * 1000; // 8 دقائق
    const saveOnLogin= options.saveOnLogin !== false;

    let lastHash = null;

    function hashState(state) {
      return state.length + "_" + (state[0]?.value?.length || 0);
    }

    function saveState(force = false) {
      try {
        const state = api.getAppState();
        if (!state || state.length === 0) { logger("[ AYMAN ] AppState فارغ — تخطي", "warn"); return; }

        const h = hashState(state);
        if (!force && h === lastHash) return; // لا تغيير
        lastHash = h;

        // Atomic write
        const tmp = filePath + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(state, null, "\t"), "utf8");
        fs.renameSync(tmp, filePath);
        logger(`[ AYMAN ] AppState محفوظ ✅ (${filePath})`, "info");
      } catch (err) {
        logger(`[ AYMAN ] خطأ حفظ AppState: ${err?.message || err}`, "error");
      }
    }

    // حفظ فوري عند اللوجين
    let initTimer = null;
    if (saveOnLogin) { initTimer = setTimeout(() => { saveState(true); initTimer = null; }, 2000); }

    // حفظ دوري
    const intervalId = setInterval(() => saveState(), intervalMs);
    logger(`[ AYMAN ] حفظ تلقائي كل ${Math.round(intervalMs/60000)} دقيقة ✅`, "info");

    if (!ctx._autoSaveInterval) ctx._autoSaveInterval = [];
    ctx._autoSaveInterval.push(intervalId);

    // حفظ عند الإيقاف
    const exitHandler = () => saveState(true);
    process.once("SIGINT",  exitHandler);
    process.once("SIGTERM", exitHandler);

    return function disableAutoSaveAppState() {
      if (initTimer) { clearTimeout(initTimer); initTimer = null; }
      clearInterval(intervalId);
      process.removeListener("SIGINT",  exitHandler);
      process.removeListener("SIGTERM", exitHandler);
      const idx = ctx._autoSaveInterval?.indexOf(intervalId) ?? -1;
      if (idx !== -1) ctx._autoSaveInterval.splice(idx, 1);
      logger("[ AYMAN ] تم إيقاف الحفظ التلقائي", "info");
    };
  };
};
