// ============================================================
//  AYMAN-FCA — SmartMessageQueue
//  الفكرة 11: Smart Message Queue
//  الفكرة 8:  Network Noise Injection
//  الفكرة 18: Auto Risk Reduction
// ============================================================
"use strict";

const EventEmitter = require("events");
const logger       = require("../../func/logger");

class SmartMessageQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this._queue       = [];
    this._processing  = false;
    this._maxSize     = options.maxSize    || 200;
    this._rateMs      = options.rateMs     || 1500;
    this._burstLimit  = options.burstLimit || 5;    // max رسائل سريعة
    this._burstCount  = 0;
    this._burstReset  = null;
    this._paused      = false;
    this._active      = false;

    // Risk level: يؤثر على السرعة
    this._riskLevel   = options.riskLevel || "normal"; // low/normal/high
    this._noiseActive = options.noise !== false;
  }

  // ── حساب delay حسب Risk Level ────────────────────────────
  _getDelay() {
    const base = this._rateMs;
    const multipliers = { low: 0.5, normal: 1.0, high: 2.5 };
    const mul   = multipliers[this._riskLevel] || 1.0;
    const jitter= base * 0.3 * (Math.random() * 2 - 1);
    return Math.max(300, Math.round(base * mul + jitter));
  }

  // ── Network Noise: ضجيج شبكي عشوائي ─────────────────────
  async _injectNoise(api, ctx) {
    if (!this._noiseActive || Math.random() > 0.15) return; // 15% فقط
    try {
      const noiseTypes = ["ping", "read", "status"];
      const type = noiseTypes[Math.floor(Math.random() * noiseTypes.length)];

      if (type === "ping" && ctx?.mqttClient?.connected) {
        ctx.mqttClient.publish("/foreground_state", JSON.stringify({ foreground: true }), { qos: 0 });
      } else if (type === "read" && api?.markAsReadAll) {
        api.markAsReadAll(() => {});
      }
      // status check هو مجرد انتظار
      await new Promise(r => setTimeout(r, Math.random() * 500));
    } catch(_) {}
  }

  // ── إضافة رسالة للقائمة ──────────────────────────────────
  enqueue(sendFn, meta = {}) {
    if (this._queue.length >= this._maxSize) {
      logger.warn(`Queue ممتلئة (${this._maxSize}) — رُفضت رسالة`, "QUEUE");
      this.emit("queue:full");
      return false;
    }
    this._queue.push({ sendFn, meta, addedAt: Date.now() });
    if (this._active && !this._processing && !this._paused) {
      this._process();
    }
    return true;
  }

  // ── معالجة القائمة ───────────────────────────────────────
  async _process() {
    if (this._processing || this._paused || !this._queue.length) return;
    this._processing = true;

    while (this._queue.length > 0 && !this._paused) {
      const item = this._queue.shift();

      // Burst Control
      this._burstCount++;
      if (this._burstCount >= this._burstLimit) {
        this._burstCount = 0;
        const burstPause = 3000 + Math.random() * 2000;
        logger.warn(`Queue Burst Control — توقف ${Math.round(burstPause)}ms`, "QUEUE");
        await new Promise(r => setTimeout(r, burstPause));
      }

      try {
        const start = Date.now();
        await item.sendFn();
        const latency = Date.now() - start;
        this.emit("queue:sent", { latency, meta: item.meta });
      } catch(e) {
        logger.warn(`Queue: فشل إرسال — ${e?.message || e}`, "QUEUE");
        this.emit("queue:error", { error: e, meta: item.meta });
      }

      // delay ذكي بين الرسائل
      if (this._queue.length > 0) {
        await new Promise(r => setTimeout(r, this._getDelay()));
      }
    }

    this._processing = false;
  }

  // ── إيقاف مؤقت (Silent Mode) ─────────────────────────────
  pause(reason = "") {
    this._paused = true;
    logger.warn(`Queue مُوقفة مؤقتاً — ${reason}`, "QUEUE");
    this.emit("queue:paused");
  }

  resume() {
    this._paused = false;
    logger.info("Queue استُؤنفت ✅", "QUEUE");
    this.emit("queue:resumed");
    if (this._active && !this._processing) this._process();
  }

  // ── تغيير Risk Level ──────────────────────────────────────
  setRiskLevel(level) {
    this._riskLevel = level;
    logger.info(`Queue Risk Level: ${level}`, "QUEUE");
  }

  start() {
    this._active = true;
    // Reset burst كل دقيقة
    this._burstReset = setInterval(() => { this._burstCount = 0; }, 60000);
    logger.info("SmartMessageQueue: مفعّل ✅", "QUEUE");
  }

  stop() {
    this._active    = false;
    this._paused    = true;
    this._queue     = [];
    if (this._burstReset) { clearInterval(this._burstReset); this._burstReset = null; }
    logger.info("SmartMessageQueue: موقوف", "QUEUE");
  }

  getStats() {
    return {
      size:       this._queue.length,
      processing: this._processing,
      paused:     this._paused,
      riskLevel:  this._riskLevel,
      burstCount: this._burstCount
    };
  }
}

module.exports = SmartMessageQueue;
