// ============================================================
//  AYMAN-FCA v2.0 — Delete Thread
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");
const { getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function deleteThread(threadOrThreads, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    if (getType(threadOrThreads) !== "Array") threadOrThreads = [threadOrThreads];

    const form = { client: "mercury" };
    threadOrThreads.forEach((id, i) => { form[`ids[${i}]`] = id; });

    defaultFuncs.post("https://www.facebook.com/ajax/mercury/delete_thread.php", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(); })
      .catch(err => { log.error("deleteThread", err); callback(err); });

    return p;
  };
};
