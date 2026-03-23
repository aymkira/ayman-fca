// ============================================================
//  AYMAN-FCA v2.0 — Log Adapter
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const logger = require("./logger");

function formatArgs(args) {
  const [prefix, msg] = args;
  if (msg === undefined) {
    if (prefix instanceof Error) return prefix.stack || prefix.message || String(prefix);
    return String(prefix ?? "");
  }
  const tag  = prefix == null ? "" : String(prefix);
  const text = msg instanceof Error
    ? (msg.message || String(msg))
    : (msg == null ? "" : String(msg));
  return tag ? `${tag}: ${text}` : text;
}

const log = {
  info:    (...args) => logger(formatArgs(args), "info"),
  warn:    (...args) => logger(formatArgs(args), "warn"),
  error:   (...args) => logger(formatArgs(args), "error"),
  verbose: (...args) => logger(formatArgs(args), "info"),
  silly:   (...args) => logger(formatArgs(args), "info"),
};

module.exports = log;
