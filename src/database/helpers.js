// ============================================================
//  AYMAN-FCA v2.0 — Database Helpers
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const DB_NOT_INIT = "Database not initialized";

function validateId(value, fieldName = "id") {
  if (value == null) throw new Error(`${fieldName} مطلوب`);
  if (typeof value !== "string" && typeof value !== "number")
    throw new Error(`${fieldName} يجب أن يكون string أو number`);
  return String(value);
}

function validateData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("data يجب أن يكون object غير فارغ");
}

function normalizeAttributes(keys) {
  if (keys == null) return undefined;
  return typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : undefined;
}

function normalizePayload(data, key = "data") {
  return Object.prototype.hasOwnProperty.call(data, key) ? data : { [key]: data };
}

function wrapError(msg, err) {
  const e = new Error(`${msg}: ${err?.message || String(err)}`);
  e.original = err;
  return e;
}

module.exports = { DB_NOT_INIT, validateId, validateData, normalizeAttributes, normalizePayload, wrapError };
