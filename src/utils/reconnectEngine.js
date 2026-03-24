// ============================================================
//  AYMAN-FCA ULTRA v3.0 — Reconnect Engine
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ Backoff: 2s→5s→10s→20s→45s→90s→180s
//  ✅ RATE_LIMIT → 60s minimum
//  ✅ Circuit Breaker: 5 فشل → يوقف 3 دقائق
//  ✅ لا crash — دائماً يُعيد المحاولة
// ============================================================
"use strict";

const EventEmitter = require("events");

const DELAYS = [2000, 5000, 10000, 20000, 45000, 90000, 180000];
const MAX_RETRIES = 25;
const CB_FAIL_THRESHOLD = 5;
const CB_RESET_MS = 3 * 60 * 1000;

let logger;
try { logger = require("../../../func/logger"); }
catch(_){ logger = (m,t)=>process.stderr.write(`[ RC ][ ${t||"info"} ] ${m}\n`); }

function classify(err){
  const msg  = String(err?.message||err?.error||err?.code||err||"");
  const code = err?.code||"";
  const netCodes = ["ECONNRESET","ETIMEDOUT","ENOTFOUND","EAI_AGAIN","EPIPE","ECONNREFUSED","ENETUNREACH"];
  if (netCodes.some(c=>code===c||msg.includes(c))) return "NETWORK";
  if (/timeout/i.test(msg))                         return "TIMEOUT";
  if (/rate.?limit|429/i.test(msg))                 return "RATE_LIMIT";
  if (/blocked|checkpoint/i.test(msg))              return "BLOCKED";
  if (/not logged in|invalid session|expired|account_inactive/i.test(msg)) return "SESSION";
  return "UNKNOWN";
}

class ReconnectEngine extends EventEmitter {
  constructor(options = {}){
    super();
    this._delays     = options.delays     || DELAYS;
    this._maxRetries = options.maxRetries || MAX_RETRIES;
    this._attempt    = 0;
    this._pending    = false;
    this._cbFails    = 0;
    this._cbOpen     = false;
    this._cbOpenAt   = 0;
  }

  _checkCircuit(){
    if (!this._cbOpen) return false;
    const elapsed = Date.now() - this._cbOpenAt;
    if (elapsed >= CB_RESET_MS){
      this._cbOpen = false; this._cbFails = 0;
      logger("Circuit Breaker: مُعاد فتحه ✅", "info");
      return false;
    }
    logger(`Circuit Breaker: مفتوح — انتظار ${Math.round((CB_RESET_MS-elapsed)/1000)}s`, "warn");
    return true;
  }

  _delay(attempt, errType){
    let base = this._delays[Math.min(attempt, this._delays.length-1)];
    if (errType==="RATE_LIMIT") base = Math.max(base, 60000);
    if (errType==="BLOCKED")    base = Math.max(base, 120000);
    const jitter = base * 0.2 * (Math.random()*2-1);
    return Math.max(1000, Math.floor(base+jitter));
  }

  async trigger(reconnectFn, err){
    if (this._pending) return false;
    if (this._checkCircuit()) return false;

    const errType = classify(err);
    if (errType==="BLOCKED"){
      logger(`محظور — لن أعيد المحاولة تلقائياً`, "error");
      this.emit("blocked");
      return false;
    }

    this._pending = true;
    this.emit("start", { attempt: this._attempt, errType });
    logger(`بدء إعادة الاتصال (${errType}): ${err?.message||err}`, "warn");

    while (this._attempt < this._maxRetries){
      const wait = this._delay(this._attempt, errType);
      logger(`محاولة ${this._attempt+1}/${this._maxRetries} بعد ${(wait/1000).toFixed(1)}s`, "warn");
      await new Promise(r=>setTimeout(r, wait));

      try {
        await reconnectFn();
        this._attempt = 0; this._cbFails = 0; this._pending = false;
        logger("إعادة الاتصال نجحت ✅", "info");
        this.emit("done", { attempts: this._attempt });
        return true;
      } catch(retryErr){
        this._attempt++; this._cbFails++;
        logger(`فشل المحاولة ${this._attempt}: ${retryErr?.message||retryErr}`, "warn");
        if (this._cbFails >= CB_FAIL_THRESHOLD){
          this._cbOpen = true; this._cbOpenAt = Date.now();
          logger(`Circuit Breaker: مفتوح بعد ${this._cbFails} فشل`, "error");
          break;
        }
      }
    }

    this._pending = false;
    logger("فشلت كل محاولات إعادة الاتصال", "error");
    this.emit("fail", { attempts: this._attempt });
    return false;
  }

  reset(){ this._attempt=0; this._cbFails=0; this._cbOpen=false; this._pending=false; }
  get isPending(){ return this._pending; }
}

module.exports = ReconnectEngine;
