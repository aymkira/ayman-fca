// ============================================================
//  AYMAN-FCA ULTRA CORE — Main Engine
//  © 2025 Ayman. All Rights Reserved.
//
//  يربط كل الأنظمة معاً:
//  SessionManager + ReconnectEngine + KeepAliveEngine
//  + Watchdog + MemoryManager + RequestQueue + HealthMonitor
// ============================================================
"use strict";

const EventEmitter     = require("events");
const path             = require("path");

const logger           = require("./core/logger");
const { login }        = require("./core/login");
const SessionManager   = require("./core/sessionManager");
const ReconnectEngine  = require("./core/reconnectEngine");
const KeepAliveEngine  = require("./core/keepAliveEngine");
const Watchdog         = require("./core/watchdog");
const MemoryManager    = require("./core/memoryManager");
const RequestQueue     = require("./core/requestQueue");
const HealthMonitor    = require("./core/healthMonitor");
const { EVENTS }       = require("./system/constants");
const { isSessionError } = require("./system/errors");

// ── معالجة الأخطاء العالمية ──────────────────────────────────────
function installGlobalHandlers() {
  process.on("unhandledRejection", (err) => {
    const msg = String(err?.message || err || "");
    if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|fetch failed|timeout/i.test(msg)) {
      logger.warn(`unhandledRejection (شبكة، مُتجاهَل): ${msg}`, "GLOBAL");
      return;
    }
    logger.error(`unhandledRejection: ${msg}`, "GLOBAL");
  });

  process.on("uncaughtException", (err) => {
    const msg = String(err?.message || err || "");
    if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|fetch failed|timeout/i.test(msg)) {
      logger.warn(`uncaughtException (شبكة، مُتجاهَل): ${msg}`, "GLOBAL");
      return;
    }
    logger.error(`uncaughtException: ${msg}`, "GLOBAL");
  });
}

// ════════════════════════════════════════════════════════════════
class AymanFCAEngine extends EventEmitter {

  constructor(options = {}) {
    super();

    this._loginLib      = options.loginLib;           // require("./includes/dongdev-FCA")
    this._appStatePath  = options.appStatePath || path.join(process.cwd(), "appstate.json");
    this._onMessage     = options.onMessage   || null;
    this._loginOptions  = options.loginOptions || {};

    this._api           = null;
    this._ctx           = null;
    this._restarting    = false;

    // ── الأنظمة ──────────────────────────────────────────────
    this.session  = new SessionManager({
      primaryPath: this._appStatePath,
      onSave:      options.onSave || null
    });

    this.reconnect = new ReconnectEngine();

    this.keepAlive = new KeepAliveEngine();

    this.watchdog  = new Watchdog();

    this.memory    = new MemoryManager();

    this.queue     = new RequestQueue();

    this.health    = new HealthMonitor();

    this._wireSystems();
    installGlobalHandlers();
  }

  // ── ربط الأنظمة ببعضها ──────────────────────────────────────
  _wireSystems() {
    // Watchdog → restart
    this.watchdog.on(EVENTS.WATCHDOG_RESTART, ({ reasons }) => {
      logger.warn(`Engine: Watchdog يطلب restart: ${reasons}`, "ENGINE");
      this.health.penalize("mqtt_dead");
      this._restart("watchdog: " + reasons);
    });

    // Health Critical → restart
    this.health.on(EVENTS.HEALTH_CRITICAL, ({ score }) => {
      logger.error(`Engine: Health منخفض (${score}) — restart`, "ENGINE");
      this._restart("health_critical");
    });

    // Session Expired → restart
    this.session.on(EVENTS.SESSION_EXPIRED, () => {
      logger.warn("Engine: الجلسة انتهت — restart", "ENGINE");
      this.health.penalize("session_expired");
      this._restart("session_expired");
    });

    // Memory High → تنظيف
    this.memory.on(EVENTS.MEMORY_HIGH, ({ pct }) => {
      logger.warn(`Engine: ذاكرة مرتفعة ${pct}%`, "ENGINE");
      this.health.penalize("memory_high");
    });

    // Reconnect Done → مكافأة
    this.reconnect.on(EVENTS.RECONNECT_DONE, () => {
      this.health.reward("reconnect_done");
    });

    // Reconnect Fail → عقوبة
    this.reconnect.on(EVENTS.RECONNECT_FAIL, () => {
      this.health.penalize("reconnect_fail");
    });
  }

  // ── استخراج ctx من api ──────────────────────────────────────
  _extractCtx(api) {
    for (const k of Object.getOwnPropertyNames(api)) {
      try {
        const v = api[k];
        if (v && typeof v === "object" && v.jar && v.userID && v.userID !== "0")
          return v;
      } catch(_) {}
    }
    return null;
  }

  // ── تشغيل كل الأنظمة بعد اللوجين ───────────────────────────
  _startSystems(api, ctx) {
    // ربط
    this.session.attach(api);
    this.keepAlive.attach(api, ctx);
    this.watchdog.attach(api, ctx);

    // تسجيل تنظيف للذاكرة
    this.memory.registerCleanup(() => {
      if (ctx?.tasks instanceof Map && ctx.tasks.size > 100) ctx.tasks.clear();
    });

    // تشغيل
    this.session.start();
    this.keepAlive.start();
    this.watchdog.start();
    this.memory.start();
    this.queue.start();
    this.health.start();

    // ✅ Watchdog heartbeat عند كل message
    if (ctx?._emitter) {
      ctx._emitter.on("message", () => {
        this.watchdog.heartbeat();
        this.health.reward("message_ok");
      });

      // watchdog reconnect event
      ctx._emitter.on("watchdog_reconnect", ({ reason }) => {
        this._restart(reason);
      });
    }

    logger.info("Engine: كل الأنظمة تعمل ✅", "ENGINE");
  }

  // ── إيقاف كل الأنظمة ────────────────────────────────────────
  _stopSystems() {
    try { this.session.stop();   } catch(_) {}
    try { this.keepAlive.stop(); } catch(_) {}
    try { this.watchdog.stop();  } catch(_) {}
    try { this.memory.stop();    } catch(_) {}
    try { this.queue.stop();     } catch(_) {}
    try { this.health.stop();    } catch(_) {}
  }

  // ── إعادة تشغيل ذكية ────────────────────────────────────────
  async _restart(reason) {
    if (this._restarting) return;
    this._restarting = true;

    logger.warn(`Engine: إعادة تشغيل — السبب: ${reason}`, "ENGINE");

    // حفظ الجلسة
    try { this.session.stop(); } catch(_) {}

    // إيقاف الأنظمة
    this._stopSystems();

    // أوقف MQTT
    try {
      if (this._ctx?.mqttClient) {
        this._ctx.mqttClient.removeAllListeners();
        this._ctx.mqttClient.end(true);
      }
    } catch(_) {}

    // انتظر ثم أعد تشغيل
    const ok = await this.reconnect.trigger(
      async () => { await this.start(); },
      new Error(reason)
    );

    if (!ok) {
      logger.error("Engine: فشلت إعادة التشغيل", "ENGINE");
    }

    this._restarting = false;
  }

  // ── callback الرسائل ────────────────────────────────────────
  _buildListener() {
    return (error, message) => {
      if (error) {
        if (error?.type === "stop_listen") return;

        if (error?.type === "account_inactive" || isSessionError(error)) {
          logger.warn(`Engine: جلسة منتهية: ${error.reason || error.error}`, "ENGINE");
          this.health.penalize("session_expired");
          this._restart("account_inactive");
          return;
        }

        logger.warn(`Engine: خطأ في listener: ${JSON.stringify(error)}`, "ENGINE");
        this.health.penalize("error");
        this._restart("listen_error");
        return;
      }

      if (!message) return;
      this.watchdog.heartbeat();
      this.health.reward("message_ok");

      // تجاهل أحداث غير مهمة
      if (["presence", "typ", "read_receipt"].includes(message.type)) return;

      if (this._onMessage) {
        try { this._onMessage(null, message); }
        catch(e) { logger.warn(`Engine: خطأ في onMessage: ${e?.message}`, "ENGINE"); }
      }

      this.emit("message", message);
    };
  }

  // ── الدخول الرئيسي ──────────────────────────────────────────
  async start() {
    logger.info("Engine: بدء التشغيل ✅", "ENGINE");

    // تسجيل الدخول
    this._api = await login(this._loginLib, this._appStatePath, this._loginOptions);
    this._ctx = this._extractCtx(this._api);

    if (this._ctx) {
      this._api.ctx     = this._ctx;
      this._api.ctxMain = this._ctx;
      logger.info(`Engine: ctx مُستخرج | UID: ${this._ctx.userID}`, "ENGINE");
    } else {
      logger.warn("Engine: ctx غير موجود — بعض الأنظمة ستعمل بشكل محدود", "ENGINE");
    }

    // حفظ الجلسة فوراً
    try {
      const state = this._api.getAppState();
      this.session.save(state, true);
    } catch(_) {}

    // تشغيل كل الأنظمة
    this._startSystems(this._api, this._ctx || {});

    // تشغيل الاستماع
    const listenerCb = this._buildListener();
    this._api.listenMqtt(listenerCb);

    logger.info("Engine: يستمع ✅", "ENGINE");
    return this._api;
  }

  // ── إيقاف آمن ────────────────────────────────────────────────
  async stop() {
    logger.info("Engine: إيقاف آمن...", "ENGINE");
    this._stopSystems();
    try {
      if (this._api?.stopListening) this._api.stopListening();
    } catch(_) {}
    logger.info("Engine: موقوف ✅", "ENGINE");
  }

  // ── API helpers ───────────────────────────────────────────────
  get api()    { return this._api; }
  get ctx()    { return this._ctx; }
  getHealth()  { return this.health.getStats(); }
  getMemory()  { return this.memory.getStats(); }
  getQueue()   { return this.queue.getStats(); }
}

module.exports = AymanFCAEngine;
