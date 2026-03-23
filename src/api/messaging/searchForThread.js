// ============================================================
//  AYMAN-FCA v2.0 — Search For Thread
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { parseAndCheckLogin } = require("../../utils/client");
const { formatThread } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function searchForThread(name, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    defaultFuncs.post(
      "https://www.facebook.com/ajax/mercury/search_threads.php",
      ctx.jar,
      { client: "web_messenger", query: name, offset: 0, limit: 21, index: "fbid" }
    )
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => {
        if (res.error) throw res;
        const threads = res.payload?.mercury_payload?.threads;
        if (!threads) return callback({ error: `لم يُعثر على "${name}"` });
        callback(null, threads.map(formatThread));
      })
      .catch(err => callback(err));

    return p;
  };
};
