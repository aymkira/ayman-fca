// ============================================================
//  AYMAN-FCA v2.0 — Set Message Reaction
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const logger = require("../../../func/logger");
const { generateOfflineThreadingID, getCurrentTimestamp } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function setMessageReaction(reaction, messageID, threadID, callback, forceCustomReaction) {
    if (typeof threadID === "function")  { forceCustomReaction = callback; callback = threadID; threadID = undefined; }
    else if (typeof threadID === "boolean") { forceCustomReaction = threadID; threadID = undefined; }
    else if (typeof callback === "boolean") { forceCustomReaction = callback; callback = undefined; }

    const cb = typeof callback === "function" ? callback : undefined;

    return new Promise((resolve, reject) => {
      if (!ctx.mqttClient) {
        const err = new Error("AYMAN-FCA: MQTT غير متصل");
        cb?.(err); return reject(err);
      }
      if (reaction === undefined || reaction === null || !messageID || !threadID) {
        const err = new Error("reaction و messageID و threadID مطلوبة");
        cb?.(err); return reject(err);
      }

      if (typeof ctx.wsReqNumber  !== "number") ctx.wsReqNumber  = 0;
      if (typeof ctx.wsTaskNumber !== "number") ctx.wsTaskNumber = 0;
      const reqID  = ++ctx.wsReqNumber;
      const taskID = ++ctx.wsTaskNumber;

      const content = {
        app_id:     "2220391788200892",
        payload:    JSON.stringify({
          epoch_id:   parseInt(generateOfflineThreadingID()),
          tasks: [{
            failure_count: null,
            label:         "29",
            payload:       JSON.stringify({
              thread_key:        threadID,
              timestamp_ms:      getCurrentTimestamp(),
              message_id:        messageID,
              reaction,
              actor_id:          ctx.userID,
              reaction_style:    forceCustomReaction ? 1 : null,
              sync_group:        1,
              send_attribution:  65537,
              dataclass_params:  null,
              attachment_fbid:   null
            }),
            queue_name:    "reaction:" + messageID,
            task_id:       taskID
          }],
          version_id: "24585299697835063"
        }),
        request_id: reqID,
        type:       3
      };

      let done = false;
      const timer = setTimeout(() => {
        if (done) return; done = true;
        ctx.mqttClient?.removeListener("message", handleRes);
        cb?.(null, { success: true }); resolve({ success: true });
      }, 10000);

      const handleRes = (topic, message) => {
        if (topic !== "/ls_resp") return;
        let msg;
        try { msg = JSON.parse(message.toString()); msg.payload = JSON.parse(msg.payload); } catch { return; }
        if (msg.request_id !== reqID) return;
        if (done) return; done = true;
        clearTimeout(timer);
        ctx.mqttClient?.removeListener("message", handleRes);
        cb?.(null, { success: true }); resolve({ success: true });
      };

      ctx.mqttClient.on("message", handleRes);
      ctx.mqttClient.publish("/ls_req", JSON.stringify(content), { qos: 1, retain: false }, err => {
        if (err) {
          if (done) return; done = true;
          clearTimeout(timer);
          ctx.mqttClient?.removeListener("message", handleRes);
          logger("setMessageReaction: " + err, "error");
          cb?.(err); reject(err);
        }
      });
    });
  };
};
