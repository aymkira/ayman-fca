// ============================================================
//  AYMAN-FCA ULTRA CORE — Retry Engine
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { delay } = require("./delay");
const { isRetryable, classify } = require("../system/errors");
const logger = require("../core/logger");

async function retry(fn, options = {}) {
  const {
    delays    = [1000, 3000, 5000, 10000, 30000, 60000, 120000],
    maxRetries= delays.length,
    tag       = "retry",
    onRetry   = null,
    predicate = isRetryable
  } = options;

  let lastErr;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const type = classify(err);

      // لا تعيد المحاولة إذا الخطأ غير قابل للإعادة
      if (!predicate(err)) {
        logger.warn(`لن تُعاد المحاولة (${type}): ${err?.message || err}`, tag);
        throw err;
      }

      if (i >= maxRetries) break;

      const wait = delays[Math.min(i, delays.length - 1)];
      logger.warn(`محاولة ${i + 1}/${maxRetries} — انتظار ${wait}ms (${type}): ${err?.message || err}`, tag);

      if (onRetry) {
        try { await onRetry(err, i + 1); } catch(_) {}
      }

      await delay(wait);
    }
  }

  logger.error(`فشلت كل المحاولات: ${lastErr?.message || lastErr}`, tag);
  throw lastErr;
}

module.exports = { retry };
