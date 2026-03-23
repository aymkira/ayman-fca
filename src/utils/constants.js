// ============================================================
//  AYMAN-FCA v2.0 — Constants & Utilities
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { getType } = require("./format");
const stream = require("stream");

// ✅ استخراج نص من HTML بكفاءة
function getFrom(html, a, b) {
  if (!html || !a) return undefined;
  const i = html.indexOf(a);
  if (i < 0) return undefined;
  const start = i + a.length;
  const j     = html.indexOf(b, start);
  return j < 0 ? undefined : html.slice(start, j);
}

// ✅ فحص readable stream
function isReadableStream(obj) {
  return (
    obj instanceof stream.Stream &&
    (getType(obj._read) === "Function" || getType(obj._read) === "AsyncFunction") &&
    getType(obj._readableState) === "Object"
  );
}

// ✅ توليد OfflineThreadingID فريد
function generateOfflineThreadingID() {
  const ret = [];
  const now = Date.now();
  const str = ("" + now).split("");
  for (let i = 0; i < str.length; i++) ret.push(str[i]);
  ret.push("0".repeat(Math.max(0, 16 - str.length)));
  const val = BigInt(ret.join("")) + BigInt(Math.floor(Math.random() * 4294967295));
  return val.toString();
}

// ✅ UUID v4
function getGUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

module.exports = {
  getFrom,
  isReadableStream,
  generateOfflineThreadingID,
  getGUID
};
