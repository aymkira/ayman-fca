// ============================================================
//  AYMAN-FCA ULTRA CORE — Session Manager
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ حفظ + backup + validate + restore
//  ✅ 3 نسخ احتياطية
//  ✅ hash لكشف التغيير
// ============================================================
"use strict";

const fs     = require("fs");
const path   = require("path");
const EventEmitter = require("events");
const cfg    = require("../system/config");
const logger = require("./logger");
const { EVENTS } = require("../system/constants");
const { isValidAppState, appStateHash } = require("../utils/validator");

class SessionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this._primaryPath = options.primaryPath || path.join(process.cwd(), "appstate.json");
    this._backupDir   = options.backupDir   || path.join(process.cwd(), "session_backups");
    this._onSave      = typeof options.onSave === "function" ? options.onSave : null;
    this._lastHash    = null;
    this._api         = null;
    this._saveTimer   = null;
    this._validateTimer = null;
    this._active      = false;

    this._ensureBackupDir();
  }

  _ensureBackupDir() {
    try {
      if (!fs.existsSync(this._backupDir))
        fs.mkdirSync(this._backupDir, { recursive: true });
    } catch(e) {
      logger.error(`SessionManager: لا يمكن إنشاء مجلد backup: ${e.message}`, "SESSION");
    }
  }

  // ✅ ربط الـ api
  attach(api) {
    this._api = api;
    logger.info("SessionManager: مرتبط بالـ api ✅", "SESSION");
  }

  // ✅ قراءة الجلسة من القرص
  load() {
    try {
      const raw = fs.readFileSync(this._primaryPath, "utf8");
      const state = JSON.parse(raw);
      if (isValidAppState(state)) {
        logger.info(`SessionManager: جلسة محملة (${state.length} cookie)`, "SESSION");
        return state;
      }
    } catch(_) {}

    // محاولة backup
    return this._loadFromBackup();
  }

  _loadFromBackup() {
    try {
      const files = fs.readdirSync(this._backupDir)
        .filter(f => f.endsWith(".json"))
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(this._backupDir, f)).mtimeMs
        }))
        .sort((a, b) => b.time - a.time);

      for (const file of files.slice(0, cfg.session.backupCount)) {
        try {
          const raw   = fs.readFileSync(path.join(this._backupDir, file.name), "utf8");
          const state = JSON.parse(raw);
          if (isValidAppState(state)) {
            logger.warn(`SessionManager: استُعيدت الجلسة من backup: ${file.name}`, "SESSION");
            this.emit(EVENTS.SESSION_RESTORED, { source: file.name });
            return state;
          }
        } catch(_) {}
      }
    } catch(_) {}

    logger.error("SessionManager: لا توجد جلسة صالحة", "SESSION");
    return null;
  }

  // ✅ حفظ atomic
  save(state, force = false) {
    if (!isValidAppState(state)) {
      logger.warn("SessionManager: حالة غير صالحة — تخطي الحفظ", "SESSION");
      return false;
    }

    const hash = appStateHash(state);
    if (!force && hash === this._lastHash) return false;
    this._lastHash = hash;

    // حفظ primary
    try {
      const tmp = this._primaryPath + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(state, null, "\t"), "utf8");
      fs.renameSync(tmp, this._primaryPath);
    } catch(e) {
      logger.error(`SessionManager: فشل حفظ primary: ${e.message}`, "SESSION");
      return false;
    }

    // حفظ backup
    this._saveBackup(state);

    logger.info("SessionManager: جلسة محفوظة ✅", "SESSION");
    this.emit(EVENTS.SESSION_SAVED, { hash });
    if (this._onSave) {
      try { this._onSave(state); } catch(_) {}
    }
    return true;
  }

  _saveBackup(state) {
    try {
      const ts   = Date.now();
      const file = path.join(this._backupDir, `backup_${ts}.json`);
      fs.writeFileSync(file, JSON.stringify(state, null, "\t"), "utf8");

      // احتفظ بـ N نسخ فقط
      const files = fs.readdirSync(this._backupDir)
        .filter(f => f.endsWith(".json") && f.startsWith("backup_"))
        .sort()
        .reverse();

      for (const old of files.slice(cfg.session.backupCount)) {
        try { fs.unlinkSync(path.join(this._backupDir, old)); } catch(_) {}
      }
    } catch(e) {
      logger.warn(`SessionManager: فشل حفظ backup: ${e.message}`, "SESSION");
    }
  }

  // ✅ التحقق الدوري من صحة الجلسة
  startValidation() {
    if (this._validateTimer) return;
    this._validateTimer = setInterval(async () => {
      try {
        if (!this._api?.getCurrentUserID) return;
        const uid = this._api.getCurrentUserID();
        if (!uid || uid === "0") {
          logger.warn("SessionManager: جلسة منتهية — إشارة", "SESSION");
          this.emit(EVENTS.SESSION_EXPIRED, { uid });
        } else {
          logger.debug("SessionManager: جلسة سليمة ✅", "SESSION");
          // احفظ الجلسة الأحدث
          if (this._api.getAppState) {
            const state = this._api.getAppState();
            if (isValidAppState(state)) this.save(state);
          }
        }
      } catch(e) {
        logger.warn(`SessionManager: خطأ في التحقق: ${e.message}`, "SESSION");
      }
    }, cfg.session.validateEvery);
  }

  // ✅ حفظ دوري
  startAutoSave() {
    if (this._saveTimer) return;
    this._saveTimer = setInterval(() => {
      if (!this._api?.getAppState) return;
      try {
        const state = this._api.getAppState();
        this.save(state);
      } catch(e) {
        logger.warn(`SessionManager: خطأ في الحفظ الدوري: ${e.message}`, "SESSION");
      }
    }, cfg.session.saveEvery);
  }

  start() {
    if (this._active) return;
    this._active = true;
    this.startAutoSave();
    this.startValidation();
    logger.info("SessionManager: مفعّل ✅", "SESSION");
  }

  stop() {
    this._active = false;
    if (this._saveTimer)    { clearInterval(this._saveTimer);    this._saveTimer = null; }
    if (this._validateTimer){ clearInterval(this._validateTimer); this._validateTimer = null; }
    // حفظ أخير
    if (this._api?.getAppState) {
      try { this.save(this._api.getAppState(), true); } catch(_) {}
    }
    logger.info("SessionManager: موقوف", "SESSION");
  }
}

module.exports = SessionManager;
