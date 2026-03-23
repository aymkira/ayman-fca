// ============================================================
//  AYMAN-FCA v2.0 — Handle Message Request
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");
const { getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function handleMessageRequest(threadID, accept, callback) {
    if (getType(accept) !== "Boolean") throw { error: "accept يجب أن يكون boolean" };

    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    if (getType(threadID) !== "Array") threadID = [threadID];
    const box  = accept ? "inbox" : "other";
    const form = { client: "mercury" };
    threadID.forEach((id, i) => { form[`${box}[${i}]`] = id; });

    defaultFuncs.post("https://www.facebook.com/ajax/mercury/move_thread.php", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(); })
      .catch(err => { log.error("handleMessageRequest", err); callback(err); });

    return p;
  };
};
