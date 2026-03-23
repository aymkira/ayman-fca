// ============================================================
//  AYMAN-FCA v2.0 — Add User To Group
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { generateOfflineThreadingID, getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function addUserToGroup(userID, threadID, callback) {
    return new Promise((resolve, reject) => {
      if (!ctx.mqttClient) {
        const err = new Error("AYMAN-FCA: MQTT غير متصل");
        callback?.(err); return reject(err);
      }
      if (getType(threadID) !== "Number" && getType(threadID) !== "String") {
        const err = new Error("threadID يجب أن يكون Number أو String");
        callback?.(err); return reject(err);
      }
      if (getType(userID) !== "Array") userID = [userID];

      const reqID  = ++ctx.wsReqNumber;
      const taskID = ++ctx.wsTaskNumber;

      const content = {
        app_id:     "772021112871879",
        payload:    JSON.stringify({
          epoch_id: generateOfflineThreadingID(),
          tasks: [{
            failure_count: null,
            label:         "23",
            payload:       JSON.stringify({ thread_key: threadID, contact_ids: userID, sync_group: 1 }),
            queue_name:    String(threadID),
            task_id:       taskID
          }],
          version_id: "24502707779384158"
        }),
        request_id: reqID,
        type:       3
      };

      let done = false;
      const timer = setTimeout(() => {
        if (done) return; done = true;
        ctx.mqttClient?.removeListener("message", handleRes);
        callback?.(null, { success: true }); resolve({ success: true });
      }, 10000);

      const handleRes = (topic, message) => {
        if (topic !== "/ls_resp") return;
        let msg;
        try { msg = JSON.parse(message.toString()); msg.payload = JSON.parse(msg.payload); } catch { return; }
        if (msg.request_id !== reqID) return;
        if (done) return; done = true;
        clearTimeout(timer);
        ctx.mqttClient?.removeListener("message", handleRes);
        callback?.(null, { success: true }); resolve({ success: true });
      };

      ctx.mqttClient.on("message", handleRes);
      ctx.mqttClient.publish("/ls_req", JSON.stringify(content), { qos: 1, retain: false }, err => {
        if (err) {
          if (done) return; done = true;
          clearTimeout(timer); ctx.mqttClient?.removeListener("message", handleRes);
          callback?.(err); reject(err);
        }
      });
    });
  };
};
