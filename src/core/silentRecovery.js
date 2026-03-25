// ============================================================
//  AYMAN-FCA — SilentRecovery
//  الفكرة 3:  Soft Restart بدل Hard Restart
//  الفكرة 5:  Silent Recovery Mode
//  الفكرة 20: Fail-Silent Mode
//  الفكرة 21: Auto Session Rotation
// ============================================================
"use strict";

const EventEmitter = require("events");
const logger       = require("../../func/logger");

const SILENT_TRIGGERS = [
  /login.challenge/i,
  /suspicious.activity/i,
  /checkpoint/i,
  /verification/i,
  /rate.limit/i,
  /too.many.requests/i,
  /403/,
  /blocked/i
];

class SilentRecovery extends EventEmitter {
  constructor(options = {}) {
    super();
    this._silentMode    = false;
    this._silentUntil   = 0;
    this._silentMinutes = options.silentMinutes || 10;
    this._softRestarts  = 0;
    this._maxSoftRestarts = options.maxSoftRestarts || 5;
    this._lastRotation  = Date.now();
    this._rotateEveryMs = options.rotateEveryMs || 20 * 60 * 60 * 1000; // 20 ساعة
  }

  // ── كشف هل يجب دخول Silent Mode ─────────────────────────
  shouldGoSilent(error) {
    const msg = String(error?.message || error?.error || error || "");
    return SILENT_TRIGGERS.some(pattern => pattern.test(msg));
  }

  // ── دخول Silent Mode ─────────────────────────────────────
  enterSilentMode(reason = "") {
    const ms = this._silentMinutes * 60 * 1000;
    this._silentMode  = true;
    this._silentUntil = Date.now() + ms;
    logger.warn(`Silent Mode دخل — ${reason} — مدة: ${this._silentMinutes} دقيقة`, "SILENT");
    this.emit("silent:enter", { reason, until: this._silentUntil });
  }

  // ── الخروج من Silent Mode ─────────────────────────────────
  exitSilentMode() {
    this._silentMode = false;
    logger.info("Silent Mode انتهى ✅", "SILENT");
    this.emit("silent:exit");
  }

  isSilent() {
    if (!this._silentMode) return false;
    if (Date.now() >= this._silentUntil) {
      this.exitSilentMode();
      return false;
    }
    return true;
  }

  getSilentRemaining() {
    if (!this._silentMode) return 0;
    return Math.max(0, this._silentUntil - Date.now());
  }

  // ── Soft Restart (إعادة الاتصال بدون قتل العملية) ────────
  async softRestart(restartFn, reason = "") {
    if (this._softRestarts >= this._maxSoftRestarts) {
      logger.error(`Soft Restart وصل الحد (${this._maxSoftRestarts})`, "SILENT");
      this.emit("soft:maxReached");
      return false;
    }

    this._softRestarts++;
    logger.warn(`Soft Restart #${this._softRestarts} — ${reason}`, "SILENT");

    try {
      // Fail-Silent: إعادة المحاولة بصمت
      await restartFn();
      this._softRestarts = 0; // نجح → صفر
      logger.info(`Soft Restart نجح ✅`, "SILENT");
      this.emit("soft:success");
      return true;
    } catch(e) {
      logger.warn(`Soft Restart فشل: ${e?.message || e}`, "SILENT");
      this.emit("soft:fail", { reason: e?.message });
      return false;
    }
  }

  // ── Auto Session Rotation: تجديد الجلسة قبل انتهائها ─────
  shouldRotateSession() {
    return (Date.now() - this._lastRotation) >= this._rotateEveryMs;
  }

  markSessionRotated() {
    this._lastRotation = Date.now();
    logger.info("Session Rotation تمت ✅", "SILENT");
    this.emit("session:rotated");
  }

  // ── معالجة خطأ تلقائية ────────────────────────────────────
  async handleError(error, restartFn) {
    const msg = String(error?.message || error || "");

    // Silent Mode أولاً
    if (this.shouldGoSilent(error)) {
      this.enterSilentMode(msg.slice(0, 50));

      // انتظر حتى انتهاء Silent Mode
      await new Promise(r => setTimeout(r, this.getSilentRemaining()));

      // ثم Soft Restart
      return await this.softRestart(restartFn, "after_silent");
    }

    // Fail-Silent عادي
    return await this.softRestart(restartFn, msg.slice(0, 50));
  }

  reset() {
    this._softRestarts = 0;
    this._silentMode   = false;
  }

  getStats() {
    return {
      silentMode:      this._silentMode,
      silentRemaining: this.getSilentRemaining(),
      softRestarts:    this._softRestarts,
      lastRotation:    this._lastRotation
    };
  }
}

module.exports = SilentRecovery;
