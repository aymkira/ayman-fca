// ============================================================
//  AYMAN-FCA v2.0 — Get Thread Pictures
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { parseAndCheckLogin } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {
  return function getThreadPictures(threadID, offset, limit, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    defaultFuncs.post(
      "https://www.facebook.com/ajax/messaging/attachments/sharedphotos.php",
      ctx.jar,
      { thread_id: threadID, offset, limit }
    )
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => {
        if (res.error) throw res;
        return Promise.all(
          (res.payload?.imagesData || []).map(image =>
            defaultFuncs.post(
              "https://www.facebook.com/ajax/messaging/attachments/sharedphotos.php",
              ctx.jar, { thread_id: threadID, image_id: image.fbid }
            )
              .then(parseAndCheckLogin(ctx, defaultFuncs))
              .then(r => {
                const qID = r.jsmods?.require?.[0]?.[3]?.[1]?.query_metadata?.query_path?.[0]?.message_thread;
                return r.jsmods?.require?.[0]?.[3]?.[1]?.query_results?.[qID]?.message_images?.edges?.[0]?.node?.image2;
              })
          )
        );
      })
      .then(data => callback(null, data))
      .catch(err => { log.error("getThreadPictures", err); callback(err); });

    return p;
  };
};
