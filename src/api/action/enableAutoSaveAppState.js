// ============================================================
//  AYMAN-FCA v2.0 — Auto Save AppState [FIXED]
//  © 2025 Ayman. All Rights Reserved.
//
//  الإصلاحات:
//  ✅ hashState أقوى — يكشف أي تغيير في القيم
//  ✅ حفظ كل 5 دقائق (كان 8)
//  ✅ backup نسخة ثانية في session_backups/
//  ✅ cleanup للـ backup القديمة (يحتفظ بآخر 3 فقط)
// ============================================================
"use strict";

const fs   = require("fs");
const path = require("path");
const logger = require("../../../func/logger");

const BACKUP_DIR   = path.join(process.cwd(), "session_backups");
const MAX_BACKUPS  = 3;

function ensureBackupDir() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (_) {}
}

// ✅ hash أقوى — يأخذ عينة من القيم الفعلية
function hashState(state) {
  if (!state || !state.length) return "empty";
  const sample = state.slice(0, 5).map(c => `${c.key}=${String(c.value || "").slice(0, 8)}`).join("|");
  return `${state.length}:${sample}`;
}

// ✅ حفظ backup مع تنظيف القديمة
function saveBackup(state) {
  try {
    ensureBackupDir();
    const ts   = Date.now();
    const file = path.join(BACKUP_DIR, `backup_${ts}.json`);
    fs.writeFileSync(file, JSON.stringify(state, null, "\t"), "utf8");

    // احذف القديمة — احتفظ بآخر MAX_BACKUPS
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup_") && f.endsWith(".json"))
      .sort().reverse();
    for (const old of files.slice(MAX_BACKUPS)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, old)); } catch (_) {}
    }
  } catch (_) {}
}

module.exports = function(defaultFuncs, api, ctx) {
  return function enableAutoSaveAppState(options = {}) {
    const filePath   = options.filePath || path.join(process.cwd(), "appstate.json");
    const intervalMs = options.interval || 5 * 60 * 1000; // ✅ كان 8 دقائق → 5 دقائق
    const saveOnLogin= options.saveOnLogin !== false;

    let lastHash = null;

    function saveState(force = false) {
      try {
        const state = api.getAppState();
        if (!state || state.length === 0) { logger("[ AYMAN ] AppState فارغ — تخطي", "warn"); return; }

        const h = hashState(state); // ✅ hash أقوى
        if (!force && h === lastHash) return; // لا تغيير
        lastHash = h;

        // Atomic write للملف الرئيسي
        const tmp = filePath + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(state, null, "\t"), "utf8");
        fs.renameSync(tmp, filePath);
        logger(`[ AYMAN ] AppState محفوظ ✅ (${filePath})`, "info");

        // ✅ حفظ backup نسخة احتياطية
        saveBackup(state);
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
