// ============================================================
//  AYMAN-FCA v2.0 — Change Bio
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");
const { getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function changeBio(bio, publish, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });

    if (getType(publish) === "Function" || getType(publish) === "AsyncFunction") {
      callback = publish; publish = false;
    }
    callback = callback || (err => err ? reject(err) : resolve());
    if (getType(publish) !== "Boolean") publish = false;
    if (getType(bio) !== "String") { bio = ""; publish = false; }

    const form = {
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "ProfileCometSetBioMutation",
      doc_id: "2725043627607610",
      variables: JSON.stringify({
        input: {
          bio,
          publish_bio_feed_story: publish,
          actor_id: ctx.i_userID || ctx.userID,
          client_mutation_id: String(Math.round(Math.random() * 1024))
        },
        hasProfileTileViewID: false,
        profileTileViewID: null,
        scale: 1
      }),
      av: ctx.i_userID || ctx.userID
    };

    defaultFuncs.post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => { if (res.errors) throw res; callback(); })
      .catch(err => { log.error("changeBio", err); callback(err); });

    return p;
  };
};
