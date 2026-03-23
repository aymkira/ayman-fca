// ============================================================
//  AYMAN-FCA ULTRA CORE — Memory Manager
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ مراقبة RAM كل دقيقتين
//  ✅ تنظيف تلقائي عند تجاوز 80%
//  ✅ force GC إذا كان متاحاً
//  ✅ تتبع نمو الذاكرة
// ============================================================
"use strict";

const EventEmitter = require("events");
const cfg    = require("../system/config");
const logger = require("./logger");
const { EVENTS } = require("../system/constants");

class MemoryManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this._threshold    = options.threshold    || cfg.memory.threshold;
    this._checkInterval= options.checkInterval|| cfg.memory.checkInterval;
    this._timer        = null;
    this._active       = false;
    this._history      = [];   // سجل آخر 10 قراءات
    this._cleanupFns   = [];   // وظائف تنظيف مسجّلة
  }

  // ✅ سجّل وظيفة تنظيف مخصصة
  registerCleanup(fn) {
    if (typeof fn === "function") this._cleanupFns.push(fn);
  }

  _snapshot() {
    const m = process.memoryUsage();
    return {
      heapUsed:   m.heapUsed,
      heapTotal:  m.heapTotal,
      rss:        m.rss,
      external:   m.external,
      ratio:      m.heapUsed / m.heapTotal,
      ts:         Date.now()
    };
  }

  _heapGrowthRate() {
    if (this._history.length < 2) return 0;
    const first = this._history[0];
    const last  = this._history[this._history.length - 1];
    const elapsedMin = (last.ts - first.ts) / 60000 || 1;
    return (last.heapUsed - first.heapUsed) / elapsedMin; // bytes/min
  }

  _cleanup() {
    logger.warn("MemoryManager: بدء تنظيف الذاكرة...", "MEMORY");

    // تشغيل وظائف التنظيف المسجّلة
    for (const fn of this._cleanupFns) {
      try { fn(); } catch(_) {}
    }

    // Force GC إذا كان متاحاً
    if (typeof global.gc === "function") {
      try { global.gc(); logger.info("MemoryManager: GC تم ✅", "MEMORY"); }
      catch(_) {}
    }

    // تنظيف require cache غير الضروري
    try {
      const cacheKeys = Object.keys(require.cache);
      let cleared = 0;
      for (const k of cacheKeys) {
        if (k.includes("/node_modules/") && !k.includes("core")) {
          delete require.cache[k];
          cleared++;
          if (cleared > 50) break; // لا تحذف أكثر من 50 مرة واحدة
        }
      }
    } catch(_) {}
  }

  async _check() {
    const snap = this._snapshot();
    this._history.push(snap);
    if (this._history.length > 10) this._history.shift();

    const pct      = Math.round(snap.ratio * 100);
    const growthMB = Math.round(this._heapGrowthRate() / 1024 / 1024);
    const usedMB   = Math.round(snap.heapUsed / 1024 / 1024);
    const totalMB  = Math.round(snap.heapTotal / 1024 / 1024);

    logger.debug(`MemoryManager: ${usedMB}MB/${totalMB}MB (${pct}%) growth=${growthMB}MB/min`, "MEMORY");

    if (snap.ratio > this._threshold) {
      logger.warn(`MemoryManager: ذاكرة عالية ${pct}% — تنظيف`, "MEMORY");
      this.emit(EVENTS.MEMORY_HIGH, { pct, usedMB, totalMB });
      this._cleanup();
    }
  }

  start() {
    if (this._active) return;
    this._active = true;
    this._timer  = setInterval(async () => {
      try { await this._check(); }
      catch(e) { logger.warn(`MemoryManager خطأ: ${e?.message}`, "MEMORY"); }
    }, this._checkInterval);
    logger.info("MemoryManager: مفعّل ✅", "MEMORY");
  }

  stop() {
    this._active = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    logger.info("MemoryManager: موقوف", "MEMORY");
  }

  getStats() {
    const s = this._snapshot();
    return {
      usedMB:  Math.round(s.heapUsed  / 1024 / 1024),
      totalMB: Math.round(s.heapTotal / 1024 / 1024),
      rssMB:   Math.round(s.rss       / 1024 / 1024),
      pct:     Math.round(s.ratio * 100),
      growthMBperMin: Math.round(this._heapGrowthRate() / 1024 / 1024)
    };
  }
}

module.exports = MemoryManager;
