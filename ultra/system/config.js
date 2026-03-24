// ============================================================
//  AYMAN-FCA ULTRA CORE — Config
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";
module.exports = {
  session: {
    validateEvery:  10 * 60 * 1000,  // ← كان 5 دقائق، الآن 10
    refreshEvery:    2 * 60 * 60 * 1000,  // ← جديد: 2 ساعة
    saveEvery:       8 * 60 * 1000,
    backupCount:     5               // ← كان 3، الآن 5
  },
  reconnect: {
    delays:     [2000, 5000, 10000, 20000, 45000, 90000, 180000],
    maxRetries: 25                   // ← كان 20
  },
  keepAlive: {
    interval: 3 * 60 * 1000         // ← كان 4 دقائق، الآن 3
  },
  watchdog: {
    interval:       60 * 1000,
    maxSilenceMs:    3 * 60 * 1000, // ← كان 5، الآن 3
    maxLatencyMs:   10000
  },
  memory: {
    threshold:      0.80,
    checkInterval:  2 * 60 * 1000
  },
  requestQueue: {
    rateMs:   1200,                  // ← كان 1500
    maxSize:   500
  },
  healthScore: {
    initial:       100,
    restartBelow:   35               // ← كان 40
  }
};
  }
};
