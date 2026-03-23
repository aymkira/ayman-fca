// ============================================================
//  AYMAN-FCA v2.0 — Handle Friend Request
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {
  return function handleFriendRequest(userID, accept, callback) {
    if (typeof accept !== "boolean") throw { error: "accept يجب أن يكون boolean" };

    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    const form = {
      viewer_id:  ctx.userID,
      "frefs[0]": "jwl",
      floc:       "friend_center_requests",
      ref:        "/reqs.php",
      action:     accept ? "confirm" : "reject"
    };

    defaultFuncs.post("https://www.facebook.com/requests/friends/ajax/", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.payload?.err) throw { err: res.payload.err }; callback(); })
      .catch(err => { log.error("handleFriendRequest", err); callback(err); });

    return p;
  };
};
