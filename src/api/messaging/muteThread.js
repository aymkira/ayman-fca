// ============================================================
//  AYMAN-FCA v2.0 — Mute Thread
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin, saveCookies } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {
  return function muteThread(threadID, muteSeconds, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    defaultFuncs.post("https://www.facebook.com/ajax/mercury/change_mute_thread.php", ctx.jar, {
      thread_fbid:   threadID,
      mute_settings: muteSeconds
    })
      .then(saveCookies(ctx.jar))
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(); })
      .catch(err => { log.error("muteThread", err); callback(err); });

    return p;
  };
};
