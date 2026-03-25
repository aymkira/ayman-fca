// ============================================================
//  AYMAN-FCA — GeoStabilityGuard
//  الفكرة 6:  Multi-Region Awareness
//  الفكرة 24: Geo Stability Guard
// ============================================================
"use strict";

const EventEmitter = require("events");
const logger       = require("../../func/logger");

class GeoStabilityGuard extends EventEmitter {
  constructor(options = {}) {
    super();
    this._lastRegion   = null;
    this._regionChanges= 0;
    this._maxChanges   = options.maxChanges || 3;
    this._history      = [];
    this._lockRegion   = options.lockRegion || false;
  }

  // ── تسجيل Region ─────────────────────────────────────────
  recordRegion(region) {
    if (!region) return;

    this._history.push({ region, ts: Date.now() });
    if (this._history.length > 20) this._history.shift();

    if (this._lastRegion && this._lastRegion !== region) {
      this._regionChanges++;
      logger.warn(`GeoGuard: Region تغير ${this._lastRegion} → ${region} (#${this._regionChanges})`, "GEO");
      this.emit("region:changed", { from: this._lastRegion, to: region });

      if (this._regionChanges >= this._maxChanges) {
        logger.error("GeoGuard: تغييرات كثيرة — خطر logout", "GEO");
        this.emit("region:unstable", { changes: this._regionChanges });
      }
    }

    this._lastRegion = region;
  }

  // ── هل الموقع مستقر؟ ──────────────────────────────────────
  isStable() {
    return this._regionChanges < this._maxChanges;
  }

  // ── الحصول على Region الموصى به ───────────────────────────
  getPreferredRegion() {
    if (!this._history.length) return null;
    // الـ region الأكثر تكراراً
    const counts = {};
    for (const { region } of this._history) {
      counts[region] = (counts[region] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  // ── تطبيق على ctx ──────────────────────────────────────────
  applyToCtx(ctx) {
    if (!ctx) return;

    // تسجيل region الحالي
    if (ctx.region) this.recordRegion(ctx.region);

    // إذا lock region، أعد تطبيق الـ region المفضل
    if (this._lockRegion && this._lastRegion && !ctx.region) {
      ctx.region = this._lastRegion;
      logger.info(`GeoGuard: تم تثبيت region = ${ctx.region}`, "GEO");
    }
  }

  reset() {
    this._regionChanges = 0;
    this._history       = [];
  }

  getStats() {
    return {
      currentRegion: this._lastRegion,
      regionChanges: this._regionChanges,
      stable:        this.isStable(),
      preferred:     this.getPreferredRegion()
    };
  }
}

module.exports = GeoStabilityGuard;
