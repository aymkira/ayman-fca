// ============================================================
//  AYMAN-FCA v2.0 — Login Entry Point
//  © 2025 Ayman. All Rights Reserved.
//
//  نقطة الدخول الرئيسية للمكتبة
//  تدمج: Session Keeper + Anti-Crash + Auto-Save
// ============================================================
"use strict";

const { getType }   = require("../src/utils/format");
const { setOptions }= require("./options");
const { loadConfig }= require("./config");
const loginHelper   = require("./loginHelper");
const logger        = require("../func/logger");

const { config } = loadConfig();
global.fca = { config };

// ✅ حماية عالمية من الكراش — مرة واحدة فقط
if (!global.fca._handlersInstalled) {
  global.fca._handlersInstalled = true;

  process.on("unhandledRejection", (reason) => {
    try {
      if (!reason || typeof reason !== "object") return;
      const code = reason.code || reason.cause?.code;
      const msg  = reason.message || String(reason);

      if (msg.includes("No Sequelize instance passed")) return;
      if (
        code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT" ||
        code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ECONNRESET" ||
        msg.includes("Connect Timeout") || msg.includes("fetch failed")
      ) {
        logger(`[ AYMAN ] خطأ شبكة (لن يوقف البوت): ${msg}`, "warn");
        return;
      }

      logger(`[ AYMAN ] Promise غير معالجة: ${reason?.message || String(reason)}`, "error");
    } catch (_) {}
  });

  process.on("uncaughtException", (error) => {
    try {
      const msg  = error.message || String(error);
      const code = error.code;

      if (msg.includes("No Sequelize instance passed")) return;
      if (
        code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT" ||
        msg.includes("Connect Timeout") || msg.includes("fetch failed")
      ) {
        logger(`[ AYMAN ] خطأ شبكة uncaught (لن يوقف البوت): ${msg}`, "warn");
        return;
      }

      logger(`[ AYMAN ] خطأ غير متوقع (البوت يستمر): ${msg}`, "error");
    } catch (_) {}
  });
}

function login(loginData, options, callback) {
  if (getType(options) === "Function" || getType(options) === "AsyncFunction") {
    callback = options;
    options  = {};
  }

  const globalOptions = {
    selfListen:       false,
    selfListenEvent:  false,
    listenEvents:     false,
    listenTyping:     false,
    updatePresence:   false,
    forceLogin:       false,
    autoMarkRead:     false,
    autoReconnect:    true,
    online:           true,
    emitReady:        false,
    userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  };

  setOptions(globalOptions, options);

  let prCallback = null, resolveFunc = null, rejectFunc = null, returnPromise = null;

  if (getType(callback) !== "Function" && getType(callback) !== "AsyncFunction") {
    returnPromise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc  = reject;
    });
    prCallback = (error, api) => error ? rejectFunc(error) : resolveFunc(api);
    callback   = prCallback;
  }

  // ✅ بدون autoUpdate — إقلاع فوري
  const proceed = () =>
    loginHelper(
      loginData.appState,
      loginData.Cookie,
      loginData.email,
      loginData.password,
      globalOptions,
      callback,
      prCallback
    );

  proceed();
  return returnPromise;
}

module.exports = login;
