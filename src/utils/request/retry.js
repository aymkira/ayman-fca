// ============================================================
//  AYMAN-FCA v2.0 — Smart Retry System
//  © 2025 Ayman. All Rights Reserved.
//
//  نظام إعادة محاولة ذكي مع Exponential Backoff + Jitter
//  يتعامل مع: timeout, 429, 5xx, network errors
// ============================================================
"use strict";

const { delay } = require("./client");

const RETRYABLE_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT","ETIMEDOUT","ECONNRESET",
  "ECONNREFUSED","ENOTFOUND","EPIPE","EAI_AGAIN","ENETUNREACH"
]);

function isRetryable(e) {
  const code = e?.code || e?.cause?.code || "";
  const msg  = (e?.message || "").toLowerCase();
  if (RETRYABLE_CODES.has(code)) return true;
  if (/timeout|connect timeout|network error|fetch failed|socket hang up|econnreset/i.test(msg)) return true;
  return false;
}

async function requestWithRetry(fn, retries = 3, baseDelay = 800, ctx) {
  let lastError;

  const emit = (event, payload) => {
    try {
      if (ctx?._emitter?.emit) ctx._emitter.emit(event, payload);
    } catch {}
  };

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;

      // ✅ خطأ Header — لا تعيد المحاولة أبداً
      if (e?.code === "ERR_INVALID_CHAR" || e?.message?.includes("Invalid character in header")) {
        const err = new Error("AYMAN-FCA: Invalid header — request aborted.");
        err.code = "ERR_INVALID_CHAR";
        err.originalError = e;
        return Promise.reject(err);
      }

      const status = e?.response?.status || e?.statusCode || 0;
      const url    = e?.config?.url    || "";
      const method = String(e?.config?.method || "").toUpperCase();

      // ✅ Rate Limit (429) — انتظر أطول
      if (status === 429) {
        emit("rateLimit", { status, url, method, attempt: i + 1 });
        const wait = Math.min(baseDelay * Math.pow(3, i), 60000);
        await delay(wait);
        continue;
      }

      // ✅ 4xx (غير 429) — لا تعيد
      if (status >= 400 && status < 500) {
        return e.response || Promise.reject(e);
      }

      // ✅ آخر محاولة
      if (i === retries - 1) {
        return e.response || Promise.reject(e);
      }

      // ✅ أخطاء الشبكة
      if (!status && isRetryable(e)) {
        emit("networkError", { code: e?.code || "", message: e?.message || "", url, method, attempt: i + 1 });
      }

      // ✅ Exponential Backoff + Jitter
      const wait = Math.min(
        baseDelay * Math.pow(2, i) + Math.floor(Math.random() * 400),
        30000
      );
      await delay(wait);
    }
  }

  return Promise.reject(lastError || new Error("AYMAN-FCA: Request failed after retries"));
}

module.exports = { requestWithRetry };
