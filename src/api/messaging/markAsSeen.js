// ============================================================
//  AYMAN-FCA v2.0 — Mark As Seen
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin, saveCookies } = require("../../utils/client");
const { getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function markAsSeen(seen_timestamp, callback) {
    if (getType(seen_timestamp) === "Function" || getType(seen_timestamp) === "AsyncFunction") {
      callback = seen_timestamp; seen_timestamp = Date.now();
    }
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    defaultFuncs.post("https://www.facebook.com/ajax/mercury/mark_seen.php", ctx.jar, {
      seen_timestamp: seen_timestamp || Date.now()
    })
      .then(saveCookies(ctx.jar))
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(); })
      .catch(err => { log.error("markAsSeen", err); callback(err); });

    return p;
  };
};
