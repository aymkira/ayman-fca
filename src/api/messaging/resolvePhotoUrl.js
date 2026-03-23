// ============================================================
//  AYMAN-FCA v2.0 — Resolve Photo URL
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin, saveCookies } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {
  return function resolvePhotoUrl(photoID, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    defaultFuncs.get(
      "https://www.facebook.com/mercury/attachments/photo",
      ctx.jar, { photo_id: photoID }
    )
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => {
        if (res.error) throw res;
        callback(null, res.jsmods?.require?.[0]?.[3]?.[0]);
      })
      .catch(err => { log.error("resolvePhotoUrl", err); callback(err); });

    return p;
  };
};
