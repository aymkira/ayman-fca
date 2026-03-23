// ============================================================
//  AYMAN-FCA v2.0 — Share Contact
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { generateOfflineThreadingID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function shareContact(text, senderID, threadID, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    if (!ctx.mqttClient) return callback(new Error("AYMAN-FCA: MQTT غير متصل"));

    const form = JSON.stringify({
      app_id:     "2220391788200892",
      payload:    JSON.stringify({
        tasks: [{
          label:         "359",
          payload:       JSON.stringify({
            contact_id: senderID,
            sync_group: 1,
            text:       text || "",
            thread_id:  threadID
          }),
          queue_name:    "messenger_contact_sharing",
          task_id:       (Math.random() * 1001) << 0,
          failure_count: null
        }],
        epoch_id:   generateOfflineThreadingID(),
        version_id: "7214102258676893"
      }),
      request_id: ++ctx.wsReqNumber,
      type:       3
    });

    ctx.mqttClient.publish("/ls_req", form, { qos: 1, retain: false }, err => {
      if (err) return callback(err);
      callback(null, { success: true });
      resolve({ success: true });
    });

    return p;
  };
};
