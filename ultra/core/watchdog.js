// ============================================================
//  AYMAN-FCA ULTRA CORE — Watchdog
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ يراقب كل 60 ثانية:
//    - هل MQTT متصل؟
//    - هل وصل event خلال آخر 5 دقائق؟
//    - هل الذاكرة بخير؟
//    - هل event loop حي؟
//  ✅ يُشعر بالفشل ولا يقتل العملية مباشرة
// ============================================================
"use strict";

const EventEmitter = require("events");
const cfg    = require("../system/config");
const logger = require("./logger");
const { EVENTS } = require("../system/constants");

class Watchdog extends EventEmitter {
  constructor(options = {}) {
    super();
    this._interval      = options.interval       || cfg.watchdog.interval;
    this._maxSilenceMs  = options.maxSilenceMs   || cfg.watchdog.maxSilenceMs;
    this._maxLatencyMs  = options.maxLatencyMs   || cfg.watchdog.maxLatencyMs;
    this._memThreshold  = options.memThreshold   || cfg.memory.threshold;
    this._ctx           = null;
    this._api           = null;
    this._timer         = null;
    this._active        = false;
    this._lastEventAt   = Date.now();
    this._failCount     = 0;
    this._maxFails      = options.maxFails || 3;
  }

  attach(api, ctx) {
    this._api = api;
    this._ctx = ctx;
  }

  // ✅ سجّل آخر event
  heartbeat() {
    this._lastEventAt = Date.now();
    this._failCount   = 0;
  }

  _getCtx() {
    if (this._ctx?.mqttClient !== undefined) return this._ctx;
    if (!this._api) return null;
    for (const k of Object.getOwnPropertyNames(this._api)) {
      try {
        const v = this._api[k];
        if (v && typeof v === "object" && v.jar && v.userID) { this._ctx = v; return v; }
      } catch(_) {}
    }
    return null;
  }

  // ✅ فحص MQTT
  _checkMqtt() {
    const ctx = this._getCtx();
    if (!ctx) return { ok: true, reason: "no_ctx" };
    if (ctx.mqttClient?.connected) return { ok: true };
    if (ctx.mqttClient?.reconnecting) return { ok: true, reason: "reconnecting" };
    return { ok: false, reason: "mqtt_disconnected" };
  }

  // ✅ فحص صمت الـ events
  _checkSilence() {
    const silenceMs = Date.now() - this._lastEventAt;
    if (silenceMs > this._maxSilenceMs) {
      return { ok: false, reason: `silent_${Math.round(silenceMs/1000)}s` };
    }
    return { ok: true };
  }

  // ✅ فحص الذاكرة
  _checkMemory() {
    try {
      const mem  = process.memoryUsage();
      const used = mem.heapUsed / mem.heapTotal;
      if (used > this._memThreshold) {
        return { ok: false, reason: `memory_${Math.round(used*100)}%`, pct: used };
      }
      return { ok: true, pct: used };
    } catch(_) { return { ok: true }; }
  }

  // ✅ فحص event loop
  _checkEventLoop() {
    return new Promise(resolve => {
      const start = Date.now();
      setImmediate(() => {
        const lag = Date.now() - start;
        if (lag > 2000) resolve({ ok: false, reason: `frozen_${lag}ms` });
        else resolve({ ok: true, lag });
      });
    });
  }

  async _runCheck() {
    const results = {};

    // MQTT
    results.mqtt = this._checkMqtt();

    // Silence
    results.silence = this._checkSilence();

    // Memory
    results.memory = this._checkMemory();

    // Event Loop
    results.loop = await this._checkEventLoop();

    const failed = Object.entries(results)
      .filter(([,v]) => !v.ok)
      .map(([k,v]) => `${k}:${v.reason}`);

    if (failed.length === 0) {
      this._failCount = 0;
      logger.debug(`Watchdog ✅ mem=${Math.round((results.memory.pct||0)*100)}% loop=${results.loop.lag||0}ms`, "WATCHDOG");
      return true;
    }

    this._failCount++;
    logger.warn(`Watchdog ⚠️ فشل[${this._failCount}/${this._maxFails}]: ${failed.join(", ")}`, "WATCHDOG");

    // ذاكرة مرتفعة → إشارة فقط
    if (results.memory && !results.memory.ok) {
      this.emit(EVENTS.MEMORY_HIGH, { pct: results.memory.pct });
    }

    // إذا تجاوز الحد → إشارة restart
    if (this._failCount >= this._maxFails) {
      const reasons = failed.join(", ");
      logger.error(`Watchdog 💀 يطلب restart: ${reasons}`, "WATCHDOG");
      this._failCount = 0;
      this.emit(EVENTS.WATCHDOG_RESTART, { reasons });
    }

    return false;
  }

  start() {
    if (this._active) return;
    this._active = true;

    const run = async () => {
      try { await this._runCheck(); } catch(e) {
        logger.warn(`Watchdog خطأ داخلي: ${e?.message || e}`, "WATCHDOG");
      }
      if (this._active) this._timer = setTimeout(run, this._interval);
    };

    this._timer = setTimeout(run, this._interval);
    logger.info("Watchdog: مفعّل ✅", "WATCHDOG");
  }

  stop() {
    this._active = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    logger.info("Watchdog: موقوف", "WATCHDOG");
  }
}

module.exports = Watchdog;
