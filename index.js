// ============================================================
//  AYMAN-FCA v2.0 — ULTRA MASTER ENGINE
//  © 2026 Ayman. All Rights Reserved.
//
//  يجمع كل الأنظمة:
//  ① SessionManager   — جلسة + backup + validate
//  ② ReconnectEngine  — Circuit Breaker + backoff
//  ③ KeepAliveEngine  — نشاط حقيقي كل 4 دقائق
//  ④ Watchdog         — مراقبة MQTT + صمت
//  ⑤ HealthMonitor    — Score 0-100
//  ⑥ MemoryManager    — تنظيف ذاكرة
//  ⑦ BehaviorEngine   — محاكاة إنسان
//  ⑧ SmartCooldown    — تحكم ذكي بالسرعة
//  ⑨ SilentRecovery   — Soft Restart + Silent Mode
//  ⑩ SmartMessageQueue— Queue ذكي
//  ⑪ GeoGuard         — حماية الموقع الجغرافي
// ============================================================
"use strict";

const EventEmitter      = require("events");
const path              = require("path");

// المسار المصحح للوصول إلى المجلد الوظيفي في الجذر
const logger = require("./func/logger");

const SessionManager    = require("./core/sessionManager");
const ReconnectEngine   = require("./core/reconnectEngine");
const KeepAliveEngine   = require("./core/keepAliveEngine");
const Watchdog          = require("./core/watchdog");
const HealthMonitor     = require("./core/healthMonitor");
const MemoryManager     = require("./core/memoryManager");
const BehaviorEngine    = require("./core/behaviorEngine");
const SmartCooldown     = require("./core/smartCooldown");
const SilentRecovery    = require("./core/silentRecovery");
const SmartMessageQueue = require("./core/smartMessageQueue");
const GeoGuard          = require("./core/geoGuard");
const { EVENTS }        = require("./system/constants");
const { isSessionError }= require("./system/errors");

class AymanFCAUltra extends EventEmitter {
  constructor(options = {}) {
    super();
    this._appStatePath = options.appStatePath || path.join(process.cwd(), "appstate.json");
    this._onMessage    = options.onMessage    || null;
    this._api          = null;
    this._ctx          = null;
    this._restarting   = false;
    this._startedAt    = Date.now();

    // ── الأنظمة ──────────────────────────────────────────────
    this.session   = new SessionManager({ primaryPath: this._appStatePath, onSave: options.onSave || null });
    this.reconnect = new ReconnectEngine();
    this.keepAlive = new KeepAliveEngine();
    this.watchdog  = new Watchdog();
    this.health    = new HealthMonitor();
    this.memory    = new MemoryManager();
    this.behavior  = new BehaviorEngine({ sessionStart: this._startedAt });
    this.cooldown  = new SmartCooldown();
    this.silent    = new SilentRecovery();
    this.queue     = new SmartMessageQueue({ noise: true });
    this.geo       = new GeoGuard({ lockRegion: true });

    this._wireSystems();
    // تأكد أن logger يحتوي على دالة banner لتجنب الأخطاء
    if (logger && typeof logger.banner === "function") logger.banner();
  }

  // ── ربط الأنظمة ببعضها ──────────────────────────────────
  _wireSystems() {
    this.watchdog.on(EVENTS.WATCHDOG_RESTART, ({ reasons }) => {
      this.health.penalize("mqtt_dead");
      this._restart("watchdog: " + reasons);
    });

    this.health.on(EVENTS.HEALTH_CRITICAL, ({ score }) => {
      logger.error(`Health منخفض (${score}) — restart`, "ULTRA");
      this._restart("health_critical");
    });

    this.session.on(EVENTS.SESSION_EXPIRED, () => {
      this.health.penalize("session_expired");
      this._restart("session_expired");
    });

    this.memory.on(EVENTS.MEMORY_HIGH, () => {
      this.health.penalize("memory_high");
      this.queue.setRiskLevel("high");
    });

    this.silent.on("silent:enter", () => {
      this.queue.pause("silent_mode");
      this.cooldown.recordError();
    });
    this.silent.on("silent:exit", () => {
      this.queue.resume();
    });

    this.reconnect.on(EVENTS.RECONNECT_DONE, () => {
      this.health.reward("reconnect_done");
      this.cooldown.reset();
      this.queue.setRiskLevel("normal");
    });
    this.reconnect.on(EVENTS.RECONNECT_FAIL, () => {
      this.health.penalize("reconnect_fail");
    });

    this.geo.on("region:unstable", () => {
      logger.warn("GeoGuard: عدم استقرار — Silent Mode", "ULTRA");
      this.silent.enterSilentMode("geo_instability");
    });

    this.health.on(EVENTS.HEALTH_LOW, () => {
      this.queue.setRiskLevel("high");
      this.cooldown.recordError();
    });
  }

  _extractCtx(api) {
    for (const k of Object.getOwnPropertyNames(api)) {
      try {
        const v = api[k];
        if (v && typeof v === "object" && v.jar && v.userID && v.userID !== "0") return v;
      } catch(_) {}
    }
    return null;
  }

  _startSystems(api, ctx) {
    this.session.attach(api);
    this.keepAlive.attach(api, ctx);
    this.watchdog.attach(api, ctx);
    this.memory.registerCleanup(() => {
      if (ctx?.tasks instanceof Map && ctx.tasks.size > 100) ctx.tasks.clear();
    });

    if (ctx?.region) this.geo.recordRegion(ctx.region);

    this.session.start();
    this.keepAlive.start();
    this.watchdog.start();
    this.health.start();
    this.memory.start();
    this.queue.start();
    this.behavior.start(ctx?.mqttClient);

    logger.info("ULTRA: كل الأنظمة تعمل ✅", "ULTRA");
    this.emit("ready", { uid: ctx?.userID });
  }

  _stopSystems() {
    ["session","keepAlive","watchdog","health","memory","queue","behavior","silent"].forEach(s => {
      try { this[s].stop(); } catch(_) {}
    });
  }

  async _restart(reason) {
    if (this._restarting) return;
    this._restarting = true;
    logger.warn(`ULTRA: إعادة تشغيل — ${reason}`, "ULTRA");

    const ok = await this.silent.softRestart(async () => {
      this._stopSystems();
      try {
        if (this._ctx?.mqttClient) {
          this._ctx.mqttClient.removeAllListeners();
          this._ctx.mqttClient.end(true);
        }
      } catch(_) {}
      await this.reconnect.trigger(async () => {
        await this.attachToApi(this._api);
      }, new Error(reason));
    }, reason);

    if (!ok) logger.error("ULTRA: فشلت إعادة التشغيل", "ULTRA");
    this._restarting = false;
  }

  buildListenerCallback() {
    return (error, message) => {
      if (error) {
        if (error?.type === "stop_listen") return;

        if (this.silent.shouldGoSilent(error)) {
          this.silent.handleError(error, () => this._restart("silent_recovery"));
          return;
        }

        if (error?.type === "account_inactive" || isSessionError(error)) {
          this.health.penalize("session_expired");
          this._restart("account_inactive");
          return;
        }

        this.health.penalize("error");
        this.cooldown.recordError();
        this._restart("listen_error");
        return;
      }

      if (!message) return;

      this.watchdog.heartbeat();
      this.health.reward("message_ok");
      this.cooldown.recordSuccess();

      if (message.region) this.geo.recordRegion(message.region);

      if (["presence","typ","read_receipt"].includes(message.type)) return;

      if (this._onMessage) {
        try { this._onMessage(null, message); } catch(e) {}
      }
      this.emit("message", message);
    };
  }

  async attachToApi(api) {
    this._api = api;
    this._ctx = this._extractCtx(api);

    if (this._ctx) {
      api.ctx = this._ctx;
      api.ctxMain = this._ctx;
      logger.info(`ULTRA مرتبط | UID: ${this._ctx.userID} | Region: ${this._ctx.region || "?"}`, "ULTRA");
    }

    await this.behavior.warmUp();

    try { this.session.save(api.getAppState(), true); } catch(_) {}

    this._startSystems(api, this._ctx || {});

    return api;
  }

  wrapSendMessage(api) {
    const original = api.sendMessage.bind(api);
    api.sendMessage = (msg, threadID, callback, messageID) => {
      this.behavior.antiRepeatDelay("send", typeof msg === "string" ? msg.slice(0, 30) : "obj");

      this.queue.enqueue(async () => {
        await this.cooldown.waitBeforeSend();
        const start = Date.now();
        return new Promise((res, rej) => {
          original(msg, threadID, (err, info) => {
            this.cooldown.recordLatency(Date.now() - start);
            if (err) { this.cooldown.recordError(); if (callback) callback(err); rej(err); }
            else { this.cooldown.recordSuccess(); if (callback) callback(null, info); res(info); }
          }, messageID);
        });
      }, { threadID });
    };
    logger.info("ULTRA: sendMessage wrapped ✅", "ULTRA");
  }

  async stop() {
    this._stopSystems();
    try { if (this._api?.stopListening) this._api.stopListening(); } catch(_) {}
    logger.info("ULTRA: موقوف ✅", "ULTRA");
  }

  get api()         { return this._api; }
  get ctx()         { return this._ctx; }
  getHealth()       { return this.health.getStats(); }
  getCooldown()     { return this.cooldown.getStats(); }
  getQueue()        { return this.queue.getStats(); }
  getGeo()          { return this.geo.getStats(); }
  getSilent()       { return this.silent.getStats(); }
}

module.exports = AymanFCAUltra;
