// ============================================================
//  AYMAN-FCA v2.0 — Unsend Message
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { generateOfflineThreadingID } = require("../../utils/format");
const log = require("../../../func/logAdapter");

module.exports = function(defaultFuncs, api, ctx) {
  return function unsendMessage(messageID, threadID, callback) {
    return new Promise((resolve, reject) => {
      if (!ctx.mqttClient) {
        const err = new Error("AYMAN-FCA: MQTT غير متصل");
        callback?.(err); return reject(err);
      }

      const reqID  = ++ctx.wsReqNumber;
      const taskID = ++ctx.wsTaskNumber;

      const content = {
        app_id:     "2220391788200892",
        payload:    JSON.stringify({
          tasks: [{
            failure_count: null,
            label:         "33",
            payload:       JSON.stringify({ message_id: messageID, thread_key: threadID, sync_group: 1 }),
            queue_name:    "unsend_message",
            task_id:       taskID
          }],
          epoch_id:   parseInt(generateOfflineThreadingID()),
          version_id: "25393437286970779"
        }),
        request_id: reqID,
        type:       3
      };

      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        ctx.mqttClient?.removeListener("message", handleRes);
        callback?.(null, { success: true });
        resolve({ success: true });
      }, 10000);

      const handleRes = (topic, message) => {
        if (topic !== "/ls_resp") return;
        let msg;
        try { msg = JSON.parse(message.toString()); msg.payload = JSON.parse(msg.payload); } catch { return; }
        if (msg.request_id !== reqID) return;
        if (done) return;
        done = true;
        clearTimeout(timer);
        ctx.mqttClient?.removeListener("message", handleRes);
        callback?.(null, { success: true });
        resolve({ success: true });
      };

      ctx.mqttClient.on("message", handleRes);
      ctx.mqttClient.publish("/ls_req", JSON.stringify(content), { qos: 1, retain: false }, err => {
        if (err) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          ctx.mqttClient?.removeListener("message", handleRes);
          log.error("unsendMessage", err);
          callback?.(err); reject(err);
        }
      });
    });
  };
};
