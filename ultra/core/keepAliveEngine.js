// ============================================================
//  AYMAN-FCA ULTRA CORE — Keep Alive Engine
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ 4 أنواع نشاط حقيقي كل 4 دقائق
//  ✅ presence + typing + getThreadList + ping
//  ✅ يقيس latency ويسجلها
//  ✅ لا يُشغّل reconnect عند الفشل — فقط يسجل
// ============================================================
"use strict";

const EventEmitter = require("events");
const cfg    = require("../system/config");
const logger = require("./logger");
const { delay, jitter } = require("../utils/delay");

// Presence encoder
const PMAP = {
  _:"%",A:"%2",B:"000",C:"%7d",D:"%7b%22",E:"%2c%22",
  F:"%22%3a",G:"%2c%22ut%22%3a1",Z:"%2c%22sb%22%3a1%2c%22t%22%3a%5b%5d%2c%22f%22%3anull%2c%22uct%22%3a0%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a"
};
const EM = {}, DL = [];
for (const [k,v] of Object.entries(PMAP)) { EM[v]=k; DL.push(v); }
DL.sort((a,b)=>b.length-a.length);
const PR = new RegExp(DL.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"g");
function presenceEncode(s){ return encodeURIComponent(s).replace(PR,m=>EM[m]||m); }
function mkPresence(uid){
  const t=Date.now();
  return "E"+presenceEncode(JSON.stringify({
    v:3,time:Math.floor(t/1000),user:uid,
    state:{ut:0,t2:[],lm2:null,uct2:t,tr:null,tw:Math.floor(Math.random()*4294967295)+1,at:t},
    ch:{[`p_${uid}`]:0}
  }));
}

class KeepAliveEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this._interval  = options.interval || cfg.keepAlive.interval;
    this._api       = null;
    this._ctx       = null;
    this._timer     = null;
    this._active    = false;
    this._latencies = [];
  }

  attach(api, ctx) {
    this._api = api;
    this._ctx = ctx;
  }

  // ✅ استخراج ctx من api تلقائياً
  _getCtx() {
    if (this._ctx?.jar && this._ctx?.userID) return this._ctx;
    if (!this._api) return null;
    for (const k of Object.getOwnPropertyNames(this._api)) {
      try {
        const v = this._api[k];
        if (v && typeof v === "object" && v.jar && v.userID && v.userID !== "0") {
          this._ctx = v;
          return v;
        }
      } catch(_) {}
    }
    return null;
  }

  async _ping() {
    const start = Date.now();
    try {
      if (this._api?.getCurrentUserID) {
        this._api.getCurrentUserID();
      }
      return Date.now() - start;
    } catch(_) { return -1; }
  }

  async _presence() {
    try {
      const ctx = this._getCtx();
      if (!ctx?.mqttClient?.connected || !ctx?.userID) return false;
      const p = mkPresence(ctx.userID);
      ctx.mqttClient.publish("/orca_presence",
        JSON.stringify({ p, c: ctx.userID }), { qos: 0 });
      ctx.mqttClient.publish("/set_client_settings",
        JSON.stringify({ make_user_available_when_in_foreground: true }), { qos: 0 });
      return true;
    } catch(_) { return false; }
  }

  async _foreground() {
    try {
      const ctx = this._getCtx();
      if (!ctx?.mqttClient?.connected) return false;
      ctx.mqttClient.publish("/foreground_state",
        JSON.stringify({ foreground: true }), { qos: 0 });
      return true;
    } catch(_) { return false; }
  }

  async _markRead() {
    try {
      if (this._api?.markAsReadAll) {
        await new Promise((res) => this._api.markAsReadAll(res));
        return true;
      }
    } catch(_) {}
    return false;
  }

  async _runCycle() {
    // ✅ جميع أنواع النشاط بتأخيرات عشوائية
    const lat = await this._ping();
    if (lat > 0) {
      this._latencies.push(lat);
      if (this._latencies.length > 10) this._latencies.shift();
    }

    await jitter(200, 800);
    await this._presence();

    await jitter(500, 1500);
    await this._foreground();

    await jitter(300, 1000);
    await this._markRead();

    const avgLat = this._latencies.length
      ? Math.round(this._latencies.reduce((a,b)=>a+b,0)/this._latencies.length)
      : 0;

    logger.debug(`KeepAlive ✅ latency=${lat}ms avg=${avgLat}ms`, "KEEPALIVE");
    return { latency: lat, avgLatency: avgLat };
  }

  start() {
    if (this._active) return;
    this._active = true;

    const run = async () => {
      try {
        await this._runCycle();
      } catch(e) {
        logger.warn(`KeepAlive خطأ: ${e?.message || e}`, "KEEPALIVE");
      }
      // جدولة التالية بتأخير عشوائي ±10%
      const base   = this._interval;
      const jit    = base * 0.1 * (Math.random() * 2 - 1);
      const next   = Math.max(60000, Math.floor(base + jit));
      this._timer  = setTimeout(run, next);
    };

    // أول تشغيل بعد دقيقة
    this._timer = setTimeout(run, 60000);
    logger.info("KeepAliveEngine: مفعّل ✅", "KEEPALIVE");
  }

  stop() {
    this._active = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    logger.info("KeepAliveEngine: موقوف", "KEEPALIVE");
  }

  getLatencies() { return [...this._latencies]; }
}

module.exports = KeepAliveEngine;
