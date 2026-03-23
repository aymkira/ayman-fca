// ============================================================
//  AYMAN-FCA v2.0 — Unfriend
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {
  return function unfriend(userID, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    const form = {
      uid:           userID,
      unref:         "bd_friends_tab",
      floc:          "friends_tab",
      "nctr[_mod]":  `pagelet_timeline_app_collection_${ctx.userID}:2356318349:2`
    };

    defaultFuncs.post("https://www.facebook.com/ajax/profile/removefriendconfirm.php", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(null, true); })
      .catch(err => { log.error("unfriend", err); callback(err); });

    return p;
  };
};
