// ============================================================
//  AYMAN-FCA v2.0 — Get User ID
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { formatID } = require("../../utils/format");
const { parseAndCheckLogin } = require("../../utils/client");

function formatData(data) {
  return {
    userID:     formatID(String(data.uid)),
    photoUrl:   data.photo,
    indexRank:  data.index_rank,
    name:       data.text,
    isVerified: data.is_verified,
    profileUrl: data.path,
    category:   data.category,
    score:      data.score,
    type:       data.type
  };
}

module.exports = function(defaultFuncs, api, ctx) {
  return function getUserID(name, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    defaultFuncs.get("https://www.facebook.com/ajax/typeahead/search.php", ctx.jar, {
      value:      name.toLowerCase(),
      viewer:     ctx.userID,
      rsp:        "search",
      context:    "search",
      path:       "/home.php",
      request_id: ctx.clientId
    })
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => {
        if (res.error) throw res;
        callback(null, (res.payload?.entries || []).map(formatData));
      })
      .catch(err => { log.error("getUserID", err); callback(err); });

    return p;
  };
};
