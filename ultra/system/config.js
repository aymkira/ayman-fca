// ============================================================
//  AYMAN-FCA ULTRA CORE — Config
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

module.exports = {
  session: {
    validateEvery:  5  * 60 * 1000,   // 5 دقائق
    refreshEvery:   10 * 60 * 1000,   // 10 دقائق
    saveEvery:      8  * 60 * 1000,   // 8 دقائق
    backupCount:    3
  },
  reconnect: {
    delays:  [1000, 3000, 5000, 10000, 30000, 60000, 120000],
    maxRetries: 20
  },
  keepAlive: {
    interval: 4 * 60 * 1000           // 4 دقائق
  },
  watchdog: {
    interval:        60 * 1000,       // دقيقة
    maxSilenceMs:    5 * 60 * 1000,   // 5 دقائق بدون event
    maxLatencyMs:    10000
  },
  memory: {
    threshold:       0.80,
    checkInterval:   2 * 60 * 1000
  },
  requestQueue: {
    rateMs:          1500,
    maxSize:         500
  },
  healthScore: {
    initial:         100,
    restartBelow:    40
  }
};
