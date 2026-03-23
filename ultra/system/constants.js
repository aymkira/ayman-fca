// ============================================================
//  AYMAN-FCA ULTRA CORE — Constants
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

module.exports = {
  NETWORK_ERRORS: new Set([
    "ECONNRESET","ETIMEDOUT","ENOTFOUND","EAI_AGAIN",
    "EPIPE","ECONNREFUSED","ENETUNREACH","EHOSTUNREACH",
    "socket hang up","connect timeout","network error"
  ]),
  SESSION_ERRORS: new Set([
    "Not logged in","invalid session","expired cookies",
    "login checkpoint","rate limit","blocked the login",
    "account_inactive","AppState expired"
  ]),
  LOG_LEVELS: { debug:0, info:1, warn:2, error:3 },
  MAX_LOG_SIZE_MB: 10,
  EVENTS: {
    SESSION_SAVED:    "session:saved",
    SESSION_EXPIRED:  "session:expired",
    SESSION_RESTORED: "session:restored",
    RECONNECT_START:  "reconnect:start",
    RECONNECT_DONE:   "reconnect:done",
    RECONNECT_FAIL:   "reconnect:fail",
    HEALTH_LOW:       "health:low",
    HEALTH_CRITICAL:  "health:critical",
    WATCHDOG_RESTART: "watchdog:restart",
    MEMORY_HIGH:      "memory:high",
    QUEUE_FULL:       "queue:full"
  }
};
