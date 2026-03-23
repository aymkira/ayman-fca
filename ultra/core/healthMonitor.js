// ============================================================
//  AYMAN-FCA ULTRA CORE — Health Monitor
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ Health Score من 0 إلى 100
//  ✅ يخصم نقاط عند كل مشكلة
//  ✅ يُشعر عند انخفاض Score
// ============================================================
"use strict";

const EventEmitter = require("events");
const logger = require("./logger");
const { EVENTS } = require("../system/constants");
const cfg = require("../system/config");

class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this._score     = options.initial || cfg.healthScore.initial;
    this._restartAt = options.restartBelow || cfg.healthScore.restartBelow;
    this._uptime    = Date.now();
    this._events    = [];   // سجل آخر 20 حدث
    this._lastCheck = Date.now();
    this._timer     = null;
    this._active    = false;
    this._interval  = options.interval || 30000;

    // نقاط الخصم لكل حدث
    this._penalties = {
      disconnect:     -20,
      reconnect_fail: -15,
      session_expired:-25,
      memory_high:    -10,
      mqtt_dead:      -20,
      error:          -5,
      slow_response:  -8
    };

    // نقاط الإضافة
    this._rewards = {
      reconnect_done: +20,
      message_ok:     +2,
      keepalive_ok:   +5,
      session_ok:     +10
    };
  }

  _clamp(v) { return Math.max(0, Math.min(100, v)); }

  penalize(event, extra = 0) {
    const delta = (this._penalties[event] || -5) + extra;
    this._score = this._clamp(this._score + delta);
    this._record(event, delta);
    this._check();
  }

  reward(event, extra = 0) {
    const delta = (this._rewards[event] || +2) + extra;
    this._score = this._clamp(this._score + delta);
    this._record(event, delta);
  }

  // تعافٍ تدريجي تلقائي: +1 كل 30 ثانية
  _autoRecover() {
    if (this._score < 100) {
      this._score = this._clamp(this._score + 1);
    }
  }

  _record(event, delta) {
    this._events.push({ event, delta, score: this._score, ts: Date.now() });
    if (this._events.length > 20) this._events.shift();
  }

  _check() {
    if (this._score <= this._restartAt) {
      logger.error(`HealthMonitor: Score منخفض جداً (${this._score}) — طلب restart`, "HEALTH");
      this.emit(EVENTS.HEALTH_CRITICAL, { score: this._score, events: this._events.slice(-5) });
    } else if (this._score <= 60) {
      logger.warn(`HealthMonitor: Score منخفض (${this._score})`, "HEALTH");
      this.emit(EVENTS.HEALTH_LOW, { score: this._score });
    }
  }

  start() {
    if (this._active) return;
    this._active = true;
    this._timer  = setInterval(() => {
      this._autoRecover();
      const uptimeMins = Math.round((Date.now() - this._uptime) / 60000);
      logger.debug(`HealthMonitor: Score=${this._score} uptime=${uptimeMins}m`, "HEALTH");
    }, this._interval);
    logger.info("HealthMonitor: مفعّل ✅", "HEALTH");
  }

  stop() {
    this._active = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  getStats() {
    return {
      score:       this._score,
      uptimeMs:    Date.now() - this._uptime,
      uptimeMins:  Math.round((Date.now() - this._uptime) / 60000),
      recentEvents:this._events.slice(-5)
    };
  }

  get score() { return this._score; }
}

module.exports = HealthMonitor;
