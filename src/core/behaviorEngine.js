// ============================================================
//  AYMAN-FCA — BehaviorEngine
//  الفكرة 1: Dynamic Human Behavior Simulation
//  الفكرة 14: Idle Simulation
//  الفكرة 15: Time-of-Day Awareness
//  الفكرة 19: Behavior Drift
//  الفكرة 23: Random Heartbeat Pattern
// ============================================================
"use strict";

const logger = require("../../func/logger");

// ── أوقات النشاط البشري ──────────────────────────────────────
const ACTIVITY_PROFILE = {
  night:   { hours: [0,1,2,3,4,5],       multiplier: 0.2 },  // خامل جداً
  morning: { hours: [6,7,8,9],           multiplier: 0.7 },  // متوسط
  day:     { hours: [10,11,12,13,14,15,16,17], multiplier: 1.0 }, // طبيعي
  evening: { hours: [18,19,20,21,22,23], multiplier: 0.8 }   // أقل قليلاً
};

// ── Behavior Drift: النشاط يتطور بمرور الوقت ─────────────────
// الأسبوع الأول بطيء جداً، يزيد تدريجياً
function getDriftMultiplier(sessionStartMs) {
  const ageDays = (Date.now() - sessionStartMs) / (1000 * 60 * 60 * 24);
  if (ageDays < 1)  return 0.3;   // يوم أول: بطيء جداً
  if (ageDays < 3)  return 0.5;   // 3 أيام: بطيء
  if (ageDays < 7)  return 0.7;   // أسبوع: متوسط
  if (ageDays < 14) return 0.9;   // أسبوعين: قريب طبيعي
  return 1.0;                      // بعدها: طبيعي
}

// ── الحصول على multiplier الوقت الحالي ──────────────────────
function getTimeMultiplier() {
  const h = new Date().getHours();
  for (const [, profile] of Object.entries(ACTIVITY_PROFILE)) {
    if (profile.hours.includes(h)) return profile.multiplier;
  }
  return 1.0;
}

class BehaviorEngine {
  constructor(options = {}) {
    this._sessionStart = options.sessionStart || Date.now();
    this._baseDelay    = options.baseDelay    || 2000;
    this._patternMap   = new Map(); // كشف التكرار
    this._lastActivity = Date.now();
    this._idleTimer    = null;
    this._active       = false;
  }

  // ① delay بشري عشوائي مع مراعاة الوقت والعمر
  humanDelay(min = 500, max = 3000) {
    const timeMul  = getTimeMultiplier();
    const driftMul = getDriftMultiplier(this._sessionStart);
    const combined = timeMul * driftMul;

    const adjustedMin = Math.round(min / combined);
    const adjustedMax = Math.round(max / combined);
    const base = Math.floor(Math.random() * (adjustedMax - adjustedMin + 1)) + adjustedMin;

    // jitter ±15%
    const jitter = base * 0.15 * (Math.random() * 2 - 1);
    const delay  = Math.max(200, Math.round(base + jitter));

    return new Promise(r => setTimeout(r, delay));
  }

  // ② كشف الأنماط المتكررة (الفكرة 12: Anti-Pattern Detection)
  trackPattern(key, value) {
    const k = `${key}:${value}`;
    const count = (this._patternMap.get(k) || 0) + 1;
    this._patternMap.set(k, count);

    // تنظيف القديم كل 100 entry
    if (this._patternMap.size > 100) {
      const first = this._patternMap.keys().next().value;
      this._patternMap.delete(first);
    }

    return count;
  }

  // إذا نفس الرسالة 3+ مرات → delay إضافي
  async antiRepeatDelay(key, value) {
    const count = this.trackPattern(key, value);
    if (count >= 3) {
      const extra = Math.min(count * 1000, 10000);
      logger.warn(`Anti-Pattern: تكرار (${count}x) — delay ${extra}ms`, "BEHAVIOR");
      await new Promise(r => setTimeout(r, extra));
    }
  }

  // ③ Connection Warm-Up (الفكرة 13)
  async warmUp() {
    logger.info("Connection Warm-Up بدأ...", "BEHAVIOR");
    await this.humanDelay(2000, 5000);  // انتظر
    logger.info("Warm-Up: read phase...", "BEHAVIOR");
    await this.humanDelay(1000, 3000);  // قراءة
    logger.info("Warm-Up: idle phase...", "BEHAVIOR");
    await this.humanDelay(3000, 8000);  // خمول
    logger.info("Warm-Up مكتمل ✅", "BEHAVIOR");
  }

  // ④ Idle Simulation - خمول عشوائي
  scheduleIdleBreak(mqttClient) {
    if (!this._active) return;
    // كل 15-45 دقيقة خمول عشوائي من 2-10 دقائق
    const nextIdleIn = (15 + Math.random() * 30) * 60 * 1000;

    this._idleTimer = setTimeout(async () => {
      if (!this._active) return;
      const idleMs = (2 + Math.random() * 8) * 60 * 1000;
      logger.info(`Idle Simulation: خمول ${Math.round(idleMs/60000)} دقيقة`, "BEHAVIOR");

      // foreground = false أثناء الخمول
      try {
        if (mqttClient?.connected) {
          mqttClient.publish("/foreground_state", JSON.stringify({ foreground: false }), { qos: 0 });
        }
      } catch(_) {}

      await new Promise(r => setTimeout(r, idleMs));

      // عودة للنشاط
      try {
        if (mqttClient?.connected) {
          mqttClient.publish("/foreground_state", JSON.stringify({ foreground: true }), { qos: 0 });
        }
      } catch(_) {}

      logger.info("Idle Simulation: عادة للنشاط ✅", "BEHAVIOR");
      this.scheduleIdleBreak(mqttClient); // جدول التالي
    }, nextIdleIn);
  }

  // ⑤ Random Heartbeat - نبضة غير ثابتة
  getHeartbeatDelay() {
    // بين 20-40 ثانية مع variation حسب الوقت
    const base    = 25000;
    const range   = 15000;
    const timeMul = getTimeMultiplier();
    return Math.round((base + Math.random() * range) / timeMul);
  }

  // ⑥ Session Age Awareness (الفكرة 2)
  getSessionAge() {
    return Date.now() - this._sessionStart;
  }

  isSessionAging() {
    return this.getSessionAge() > 20 * 60 * 60 * 1000; // أكثر من 20 ساعة
  }

  // تقليل النشاط عند شيخوخة الجلسة
  getAgedActivityMultiplier() {
    const agingMs = this.getSessionAge();
    const agingH  = agingMs / (60 * 60 * 1000);
    if (agingH < 12) return 1.0;
    if (agingH < 20) return 0.8;
    if (agingH < 30) return 0.6;
    return 0.4; // بعد 30 ساعة: نشاط منخفض جداً
  }

  start(mqttClient) {
    this._active = true;
    this.scheduleIdleBreak(mqttClient);
    logger.info("BehaviorEngine: مفعّل ✅", "BEHAVIOR");
  }

  stop() {
    this._active = false;
    if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null; }
  }
}

module.exports = BehaviorEngine;
