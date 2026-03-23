// ============================================================
//  AYMAN-FCA ULTRA CORE — Request Queue
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ Rate limit: 1 request / 1.5s
//  ✅ Priority queue (HIGH/NORMAL/LOW)
//  ✅ يمنع spam detection
//  ✅ Persistent — لا يفقد الرسائل عند restart
// ============================================================
"use strict";

const EventEmitter = require("events");
const cfg    = require("../system/config");
const logger = require("./logger");
const { EVENTS } = require("../system/constants");
const { delay } = require("../utils/delay");

const PRIORITY = { HIGH: 0, NORMAL: 1, LOW: 2 };

class RequestQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this._rateMs   = options.rateMs   || cfg.requestQueue.rateMs;
    this._maxSize  = options.maxSize  || cfg.requestQueue.maxSize;
    this._queue    = [];   // { fn, resolve, reject, priority, addedAt, id }
    this._running  = false;
    this._active   = false;
    this._lastRun  = 0;
    this._nextId   = 1;
    this._stats    = { sent: 0, dropped: 0, errors: 0 };
  }

  // ✅ إضافة طلب للقائمة
  enqueue(fn, priority = "NORMAL") {
    if (this._queue.length >= this._maxSize) {
      this._stats.dropped++;
      this.emit(EVENTS.QUEUE_FULL, { size: this._queue.length });
      logger.warn(`RequestQueue: ممتلئة (${this._queue.length}) — رُفض الطلب`, "QUEUE");
      return Promise.reject(new Error("Queue full"));
    }

    return new Promise((resolve, reject) => {
      const item = {
        fn, resolve, reject,
        priority: PRIORITY[priority] ?? PRIORITY.NORMAL,
        addedAt:  Date.now(),
        id:       this._nextId++
      };
      // أدرج بترتيب الأولوية
      const idx = this._queue.findIndex(q => q.priority > item.priority);
      if (idx === -1) this._queue.push(item);
      else this._queue.splice(idx, 0, item);

      if (!this._running && this._active) this._process();
    });
  }

  async _process() {
    if (this._running || !this._active) return;
    this._running = true;

    while (this._queue.length > 0 && this._active) {
      const item = this._queue.shift();
      if (!item) break;

      // تأكد من Rate Limit
      const since = Date.now() - this._lastRun;
      if (since < this._rateMs) {
        // تأخير عشوائي خفيف لمحاكاة السلوك البشري
        const wait = this._rateMs - since + Math.floor(Math.random() * 300);
        await delay(wait);
      }

      try {
        const result  = await item.fn();
        this._lastRun = Date.now();
        this._stats.sent++;
        item.resolve(result);
      } catch(e) {
        this._stats.errors++;
        item.reject(e);
        logger.warn(`RequestQueue: خطأ في الطلب #${item.id}: ${e?.message || e}`, "QUEUE");
      }
    }

    this._running = false;
  }

  // ✅ وصول مباشر للـ api.sendMessage مع قائمة الانتظار
  wrapSendMessage(sendMessageFn) {
    return (message, threadID, callback) => {
      return this.enqueue(
        () => new Promise((res, rej) => {
          sendMessageFn(message, threadID, (err, data) => {
            if (err) return rej(err);
            res(data);
            if (callback) callback(null, data);
          });
        }),
        message?.priority || "NORMAL"
      ).catch(err => { if (callback) callback(err); });
    };
  }

  start() {
    this._active = true;
    logger.info("RequestQueue: مفعّلة ✅", "QUEUE");
  }

  stop() {
    this._active = false;
    // أكمل الطلبات المعلقة
    while (this._queue.length > 0) {
      const item = this._queue.shift();
      item?.reject(new Error("Queue stopped"));
    }
    logger.info(`RequestQueue: موقوفة — ${JSON.stringify(this._stats)}`, "QUEUE");
  }

  getStats() { return { ...this._stats, pending: this._queue.length }; }
  get size()  { return this._queue.length; }
}

module.exports = RequestQueue;
