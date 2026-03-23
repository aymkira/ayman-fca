// ============================================================
//  AYMAN-FCA v2.0 — Mark As Delivered
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin, saveCookies } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {
  return function markAsDelivered(threadID, messageID, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    if (!threadID || !messageID) return callback("threadID و messageID مطلوبان");

    const form = {
      [`message_ids[0]`]:               messageID,
      [`thread_ids[${threadID}][0]`]:   messageID
    };

    defaultFuncs.post("https://www.facebook.com/ajax/mercury/delivery_receipts.php", ctx.jar, form)
      .then(saveCookies(ctx.jar))
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(); })
      .catch(err => { log.error("markAsDelivered", err); callback(err); });

    return p;
  };
};
