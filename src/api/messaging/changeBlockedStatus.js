// ============================================================
//  AYMAN-FCA v2.0 — Change Blocked Status
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin, saveCookies } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {
  return function changeBlockedStatus(userID, block, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    defaultFuncs.post(
      `https://www.facebook.com/messaging/${block ? "" : "un"}block_messages/`,
      ctx.jar, { fbid: userID }
    )
      .then(saveCookies(ctx.jar))
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(); })
      .catch(err => { log.error("changeBlockedStatus", err); callback(err); });

    return p;
  };
};
