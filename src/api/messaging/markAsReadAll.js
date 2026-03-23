// ============================================================
//  AYMAN-FCA v2.0 — Mark As Read All
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin, saveCookies } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {
  return function markAsReadAll(callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    defaultFuncs.post(
      "https://www.facebook.com/ajax/mercury/mark_folder_as_read.php",
      ctx.jar,
      { folder: "inbox" }
    )
      .then(saveCookies(ctx.jar))
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(); })
      .catch(err => { log.error("markAsReadAll", err); callback(err); });

    return p;
  };
};
