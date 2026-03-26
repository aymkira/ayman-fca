// ═══════════════════════════════════════════════════════════════
//  AYMAN-FCA ULTRA v4.0 — KIRA BOT
//  © 2026 Ayman | كيرا بوت | All Rights Reserved.
//  أقوى مكتبة FCA في العالم — ما تطلع أبدًا يا زلمة
//  لهجة بغدادية: يلا خلينا نحمي البوت من كل شي
// ═══════════════════════════════════════════════════════════════

"use strict";

module.exports = {
  session: {
    validateEvery:  8 * 60 * 1000,     // كل 8 دقايق نشيك على الجلسة
    saveEvery:      5 * 60 * 1000,     // حفظ كل 5 دقايق
    backupCount:    7,                 // 7 نسخ احتياطية (زودتها)
    refreshEvery:   60 * 60 * 1000     // تجديد كل ساعة
  },

  reconnect: {
    delays:     [1500, 4000, 8000, 15000, 30000, 60000, 120000, 240000],
    maxRetries: 30                     // صمود أكثر
  },

  keepAlive: {
    interval: 2 * 60 * 1000            // كل دقيقتين نرسل keep alive
  },

  watchdog: {
    interval:      45 * 1000,          // نشيك كل 45 ثانية
    maxSilenceMs:  4 * 60 * 1000,      // 4 دقايق صمت = خطر
    maxLatencyMs:  8000
  },

  memory: {
    threshold:     0.78,               // 78% RAM = تنظيف فوري
    checkInterval: 90 * 1000
  },

  requestQueue: {
    rateMs:   1100,                    // أسرع شوية بس ما نسبب بان
    maxSize:   600
  },

  healthScore: {
    initial:      100,
    restartBelow: 32                   // لو نزل تحت 32 = restart تلقائي
  }
};
