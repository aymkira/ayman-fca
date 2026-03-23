// ============================================================
//  AYMAN-FCA v2.0 — Forward Attachment
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { generateOfflineThreadingID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function forwardAttachment(threadID, forwardedMsgID, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    if (!ctx.mqttClient) {
      const err = new Error("AYMAN-FCA: MQTT غير متصل");
      callback(err); return p;
    }

    const form = JSON.stringify({
      app_id:     "772021112871879",
      payload:    JSON.stringify({
        epoch_id:   generateOfflineThreadingID(),
        tasks: [{
          failure_count: null,
          label:         "46",
          payload:       JSON.stringify({
            thread_id:                  threadID,
            otid:                       generateOfflineThreadingID(),
            source:                     65544,
            send_type:                  5,
            sync_group:                 1,
            mark_thread_read:           0,
            forwarded_msg_id:           forwardedMsgID,
            strip_forwarded_msg_caption:0,
            initiating_source:          1
          }),
          queue_name:    String(threadID),
          task_id:       Math.floor(Math.random() * 1001)
        }],
        version_id: "8768858626531631"
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
