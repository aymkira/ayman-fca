// ============================================================
//  AYMAN-FCA v2.0 — Create New Group
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");
const { getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function createNewGroup(participantIDs, groupTitle, callback) {
    if (getType(groupTitle) === "Function") { callback = groupTitle; groupTitle = null; }
    if (getType(participantIDs) !== "Array") throw { error: "participantIDs يجب أن يكون Array" };
    if (participantIDs.length < 2) throw { error: "participantIDs يحتاج عضوين على الأقل" };

    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    const pids = participantIDs.map(id => ({ fbid: id }));
    pids.push({ fbid: ctx.i_userID || ctx.userID });

    const form = {
      fb_api_caller_class:      "RelayModern",
      fb_api_req_friendly_name: "MessengerGroupCreateMutation",
      av:                       ctx.i_userID || ctx.userID,
      doc_id:                   "577041672419534",
      variables: JSON.stringify({
        input: {
          entry_point:       "jewel_new_group",
          actor_id:          ctx.i_userID || ctx.userID,
          participants:      pids,
          client_mutation_id:String(Math.round(Math.random() * 1024)),
          thread_settings:   { name: groupTitle, joinable_mode: "PRIVATE", thread_image_fbid: null }
        }
      })
    };

    defaultFuncs.post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => {
        if (res.errors) throw res;
        callback(null, res.data?.messenger_group_thread_create?.thread?.thread_key?.thread_fbid);
      })
      .catch(err => { log.error("createNewGroup", err); callback(err); });

    return p;
  };
};
