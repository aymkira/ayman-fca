// ============================================================
//  AYMAN-FCA ULTRA CORE — Reconnect Engine
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ Exponential Backoff: 1s→3s→5s→10s→30s→60s→120s
//  ✅ خطأ-محدد: NETWORK→سريع | RATE_LIMIT→بطيء
//  ✅ Circuit Breaker: يوقف عند فشل متكرر
//  ✅ لا crash — دائماً يُعيد المحاولة
// ============================================================
"use strict";

const EventEmitter = require("events");
const cfg    = require("../system/config");
const logger = require("./logger");
const { EVENTS } = require("../system/constants");
const { classify } = require("../system/errors");
const { delay } = require("../utils/delay");

const CIRCUIT_FAIL_THRESHOLD = 7;   // فتح الدائرة بعد 7 فشل
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // إعادة الفتح بعد 5 دقائق

class ReconnectEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this._delays      = options.delays    || cfg.reconnect.delays;
    this._maxRetries  = options.maxRetries|| cfg.reconnect.maxRetries;
    this._attempt     = 0;
    this._active      = false;
    this._pending     = false;

    // Circuit Breaker
    this._cbFailures  = 0;
    this._cbOpen      = false;
    this._cbOpenAt    = 0;
  }

  // ✅ هل يجب تفعيل إعادة الاتصال لهذا الخطأ؟
  shouldReconnect(err) {
    const type = classify(err);
    return ["NETWORK","TIMEOUT","UNKNOWN"].includes(type);
  }

  // ✅ delay مخصص بناءً على نوع الخطأ
  _getDelay(attempt, errType) {
    let base = this._delays[Math.min(attempt, this._delays.length - 1)];
    if (errType === "RATE_LIMIT") base = Math.max(base, 60000);
    // jitter ±20%
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    return Math.max(500, Math.floor(base + jitter));
  }

  // ✅ Circuit Breaker check
  _checkCircuit() {
    if (!this._cbOpen) return false;
    const elapsed = Date.now() - this._cbOpenAt;
    if (elapsed >= CIRCUIT_RESET_MS) {
      this._cbOpen     = false;
      this._cbFailures = 0;
      logger.info("ReconnectEngine: Circuit Breaker مُعاد فتحه ✅", "RECONNECT");
      return false;
    }
    logger.warn(`ReconnectEngine: Circuit مفتوح — انتظار ${Math.round((CIRCUIT_RESET_MS - elapsed)/1000)}s`, "RECONNECT");
    return true;
  }

  async trigger(reconnectFn, err) {
    if (this._pending) return;
    if (this._checkCircuit()) return;

    this._pending = true;
    this._active  = true;
    const errType = classify(err);

    this.emit(EVENTS.RECONNECT_START, { attempt: this._attempt, errType });
    logger.warn(`ReconnectEngine: بدء إعادة الاتصال (${errType}): ${err?.message || err}`, "RECONNECT");

    while (this._attempt < this._maxRetries) {
      const wait = this._getDelay(this._attempt, errType);
      logger.warn(`ReconnectEngine: محاولة ${this._attempt + 1}/${this._maxRetries} بعد ${wait}ms`, "RECONNECT");

      await delay(wait);

      try {
        await reconnectFn();
        // ✅ نجاح
        this._attempt    = 0;
        this._cbFailures = 0;
        this._pending    = false;
        logger.info("ReconnectEngine: إعادة الاتصال نجحت ✅", "RECONNECT");
        this.emit(EVENTS.RECONNECT_DONE, { attempts: this._attempt });
        return true;
      } catch(retryErr) {
        this._attempt++;
        this._cbFailures++;
        logger.warn(`ReconnectEngine: فشل المحاولة ${this._attempt}: ${retryErr?.message || retryErr}`, "RECONNECT");

        // فتح Circuit Breaker
        if (this._cbFailures >= CIRCUIT_FAIL_THRESHOLD) {
          this._cbOpen   = true;
          this._cbOpenAt = Date.now();
          logger.error(`ReconnectEngine: Circuit Breaker مفتوح بعد ${this._cbFailures} فشل`, "RECONNECT");
          break;
        }
      }
    }

    this._pending = false;
    logger.error("ReconnectEngine: فشلت كل المحاولات", "RECONNECT");
    this.emit(EVENTS.RECONNECT_FAIL, { attempts: this._attempt });
    return false;
  }

  reset() {
    this._attempt    = 0;
    this._cbFailures = 0;
    this._cbOpen     = false;
    this._pending    = false;
  }

  get isPending() { return this._pending; }
}

module.exports = ReconnectEngine;
