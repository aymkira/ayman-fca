// ============================================================
//  AYMAN-FCA — SmartCooldown
//  الفكرة 4: Smart Cooldown Controller
//  الفكرة 7: Adaptive Retry Strategy
//  الفكرة 10: Activity Throttling
//  الفكرة 25: Smart Cooldown After Error
// ============================================================
"use strict";

const logger = require("../../func/logger");

class SmartCooldown {
  constructor(options = {}) {
    this._baseDelay   = options.baseDelay   || 1500;
    this._maxDelay    = options.maxDelay    || 30000;
    this._minDelay    = options.minDelay    || 300;
    this._currentDelay= this._baseDelay;

    // metrics
    this._errorCount  = 0;
    this._latencies   = [];
    this._lastErrorAt = 0;
    this._lastSendAt  = 0;

    // Exponential Backoff delays
    this._backoffLevels = [1000, 3000, 7000, 15000, 30000, 60000, 120000];
    this._backoffIndex  = 0;
  }

  // ── تسجيل latency ─────────────────────────────────────────
  recordLatency(ms) {
    this._latencies.push(ms);
    if (this._latencies.length > 20) this._latencies.shift();
    this._adjust();
  }

  // ── تسجيل خطأ → زيادة delay ───────────────────────────────
  recordError() {
    this._errorCount++;
    this._lastErrorAt = Date.now();
    this._backoffIndex = Math.min(this._backoffIndex + 1, this._backoffLevels.length - 1);
    this._currentDelay = this._backoffLevels[this._backoffIndex];
    logger.warn(`SmartCooldown: خطأ #${this._errorCount} — delay=${this._currentDelay}ms`, "COOLDOWN");
  }

  // ── نجاح → تقليل delay ────────────────────────────────────
  recordSuccess() {
    if (this._backoffIndex > 0) this._backoffIndex--;
    this._errorCount = Math.max(0, this._errorCount - 1);
    this._adjust();
  }

  // ── تعديل تلقائي حسب الأداء ──────────────────────────────
  _adjust() {
    const avgLatency = this._avgLatency();

    if (avgLatency > 5000 || this._errorCount > 5) {
      // ضغط عالٍ → إبطاء
      this._currentDelay = Math.min(this._currentDelay * 1.5, this._maxDelay);
    } else if (avgLatency < 500 && this._errorCount === 0) {
      // مستقر → تسريع
      this._currentDelay = Math.max(this._currentDelay * 0.8, this._minDelay);
    }
  }

  _avgLatency() {
    if (!this._latencies.length) return 0;
    return this._latencies.reduce((a, b) => a + b, 0) / this._latencies.length;
  }

  // ── الحصول على delay الحالي + jitter ─────────────────────
  getCurrentDelay() {
    const jitter = this._currentDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.max(this._minDelay, Math.round(this._currentDelay + jitter));
  }

  // ── انتظار ذكي قبل الإرسال ────────────────────────────────
  async waitBeforeSend() {
    const timeSinceLast = Date.now() - this._lastSendAt;
    const needed = this.getCurrentDelay();
    const wait   = Math.max(0, needed - timeSinceLast);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this._lastSendAt = Date.now();
  }

  // ── Cooldown بعد خطأ ──────────────────────────────────────
  async cooldownAfterError(reason = "") {
    const delay = this._backoffLevels[this._backoffIndex];
    logger.warn(`Cooldown بعد خطأ (${reason}): ${delay}ms`, "COOLDOWN");
    await new Promise(r => setTimeout(r, delay));
  }

  // ── إعادة ضبط ─────────────────────────────────────────────
  reset() {
    this._errorCount   = 0;
    this._backoffIndex = 0;
    this._currentDelay = this._baseDelay;
    this._latencies    = [];
  }

  getStats() {
    return {
      currentDelay: this._currentDelay,
      avgLatency:   Math.round(this._avgLatency()),
      errorCount:   this._errorCount,
      backoffLevel: this._backoffIndex
    };
  }
}

module.exports = SmartCooldown;
