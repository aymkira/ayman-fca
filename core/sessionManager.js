// ═══════════════════════════════════════════════════════════════
//  AYMAN-FCA ULTRA v4.0 — KIRA BOT
//  © 2026 Ayman | كيرا بوت | All Rights Reserved.
//  أقوى Session Manager في التاريخ — ما يخلي البوت يطلع أبدًا
//  لهجة بغدادية: يلا يا زلمة هذا اللي يحمي الجلسة من كل شي
// ═══════════════════════════════════════════════════════════════

"use strict";

const fs = require("fs");
const path = require("path");
const logger = require("./logger");
const { isValidAppState, appStateHash } = require("../utils/validator");

class SessionManager {
  constructor(options = {}) {
    this.primaryPath = options.primaryPath || path.join(process.cwd(), "appstate.json");
    this.backupDir   = path.join(process.cwd(), "session_backups");
    this._lastHash   = null;
    this._api        = null;

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  attach(api) {
    this._api = api;
    logger.success("SessionManager مرتبط بالـ API ✅", "SESSION");
  }

  load() {
    try {
      const raw = fs.readFileSync(this.primaryPath, "utf8");
      const state = JSON.parse(raw);
      if (isValidAppState(state)) {
        logger.success("AppState محمل بنجاح من الملف الرئيسي", "SESSION");
        return state;
      }
    } catch (_) {}

    // لو ما لقى → جيب من الباك اب
    return this._loadFromBackup();
  }

  _loadFromBackup() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.endsWith(".json"))
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(this.backupDir, f)).mtimeMs
        }))
        .sort((a, b) => b.time - a.time);

      for (const file of files.slice(0, 7)) {
        try {
          const raw = fs.readFileSync(path.join(this.backupDir, file.name), "utf8");
          const state = JSON.parse(raw);
          if (isValidAppState(state)) {
            logger.warn(`تم استرجاع AppState من الباك اب: ${file.name}`, "SESSION");
            return state;
          }
        } catch (_) {}
      }
    } catch (_) {}
    return null;
  }

  save(state, force = false) {
    if (!isValidAppState(state)) return false;

    const hash = appStateHash(state);
    if (!force && hash === this._lastHash) return false;
    this._lastHash = hash;

    // حفظ رئيسي
    fs.writeFileSync(this.primaryPath, JSON.stringify(state, null, 2), "utf8");

    // حفظ باك اب
    const backupName = `backup_${Date.now()}.json`;
    fs.writeFileSync(path.join(this.backupDir, backupName), JSON.stringify(state, null, 2), "utf8");

    // حذف الزايد (نخلي 7 بس)
    const allBackups = fs.readdirSync(this.backupDir).sort().reverse();
    allBackups.slice(7).forEach(f => fs.unlinkSync(path.join(this.backupDir, f)));

    logger.success("AppState محفوظ + باك اب ✅", "SESSION");
    return true;
  }
}

module.exports = SessionManager;
