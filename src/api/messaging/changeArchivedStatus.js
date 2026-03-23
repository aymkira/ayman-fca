// ============================================================
//  AYMAN-FCA v2.0 — Change Archived Status
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");
const { formatID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function changeArchivedStatus(threadOrThreads, archive, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    const form = {};
    const threads = Array.isArray(threadOrThreads) ? threadOrThreads : [threadOrThreads];
    threads.forEach(t => { form[`ids[${formatID(t)}]`] = archive; });

    defaultFuncs.post(
      "https://www.facebook.com/ajax/mercury/change_archived_status.php",
      ctx.jar, form
    )
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.error) throw res; callback(); })
      .catch(err => { log.error("changeArchivedStatus", err); callback(err); });

    return p;
  };
};
