// ============================================================
//  AYMAN-FCA ULTRA CORE — Error Classification
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { NETWORK_ERRORS, SESSION_ERRORS } = require("./constants");

class AymanError extends Error {
  constructor(message, type, original) {
    super(message);
    this.name      = "AymanError";
    this.type      = type || "UNKNOWN";
    this.original  = original || null;
    this.timestamp = Date.now();
  }
}

function classify(err) {
  const msg  = String(err?.message || err?.error || err?.code || err || "");
  const code = err?.code || "";

  for (const ne of NETWORK_ERRORS) {
    if (msg.includes(ne) || code === ne) return "NETWORK";
  }
  for (const se of SESSION_ERRORS) {
    if (msg.includes(se)) return "SESSION";
  }
  if (/timeout/i.test(msg))   return "TIMEOUT";
  if (/rate.?limit|429/i.test(msg)) return "RATE_LIMIT";
  if (/blocked|checkpoint/i.test(msg)) return "BLOCKED";
  return "UNKNOWN";
}

function isRetryable(err) {
  const type = classify(err);
  return type === "NETWORK" || type === "TIMEOUT";
}

function isSessionError(err) {
  return classify(err) === "SESSION";
}

module.exports = { AymanError, classify, isRetryable, isSessionError };
