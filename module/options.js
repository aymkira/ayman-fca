// ============================================================
//  AYMAN-FCA v2.0 — Options Handler
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { getType } = require("../src/utils/format");
const { setProxy } = require("../src/utils/request");
const logger = require("../func/logger");

const BOOL_OPTIONS = [
  "online","selfListen","listenEvents","updatePresence","forceLogin",
  "autoMarkRead","autoMarkDelivery","listenTyping","autoReconnect",
  "emitReady","selfListenEvent"
];

// خيارات قديمة يتم تجاهلها بصمت
const IGNORED = new Set(["logLevel","pauseLog","logRecordSize","updateSeq"]);

function setOptions(globalOptions, options) {
  for (const key of Object.keys(options || {})) {
    if (IGNORED.has(key)) continue;
    if (BOOL_OPTIONS.includes(key)) { globalOptions[key] = Boolean(options[key]); continue; }
    switch (key) {
      case "userAgent": globalOptions.userAgent = options.userAgent; break;
      case "pageID":    globalOptions.pageID    = String(options.pageID); break;
      case "proxy":
        if (typeof options.proxy !== "string") { delete globalOptions.proxy; setProxy(); }
        else { globalOptions.proxy = options.proxy; setProxy(options.proxy); }
        break;
      default:
        logger(`[ AYMAN ] setOptions: خيار غير معروف "${key}"`, "warn");
    }
  }
}

module.exports = { setOptions, BOOL_OPTIONS };
