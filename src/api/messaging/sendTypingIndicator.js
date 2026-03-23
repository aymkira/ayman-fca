// ============================================================
//  AYMAN-FCA v2.0 — Send Typing Indicator
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function sendTypingIndicator(threadID, isTyping, options, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });

    if (getType(options) === "Function" || getType(options) === "AsyncFunction") {
      callback = options; options = {};
    }
    options  = options || {};
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    if (!threadID) return callback(new Error("threadID مطلوب"));
    if (!ctx.mqttClient) return callback(new Error("AYMAN-FCA: MQTT غير متصل"));

    if (typeof ctx.wsReqNumber !== "number") ctx.wsReqNumber = 0;

    const ids = Array.isArray(threadID) ? threadID : [threadID];

    ids.forEach(tid => {
      const isGroup    = getType(tid) !== "Array" ? 1 : 0;
      const threadType = isGroup ? 2 : 1;
      const duration   = options.duration || 10000;
      const attribution= options.type || 0;

      const publish = (typing) => {
        ctx.mqttClient.publish("/ls_req", JSON.stringify({
          app_id: "772021112871879",
          payload: JSON.stringify({
            label:   "3",
            payload: JSON.stringify({
              thread_key:       parseInt(tid),
              is_group_thread:  isGroup,
              is_typing:        typing ? 1 : 0,
              attribution,
              sync_group:       1,
              thread_type:      threadType
            }),
            version: "8965252033599983"
          }),
          request_id: ++ctx.wsReqNumber,
          type: 4
        }), { qos: 1, retain: false });
      };

      publish(isTyping);
      if (isTyping && options.autoStop !== false) {
        setTimeout(() => publish(false), duration);
      }
    });

    callback(null, true);
    return p;
  };
};
