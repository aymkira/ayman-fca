// ============================================================
//  AYMAN-FCA v2.0 — Forward Message via MQTT
//  © 2025 Ayman. All Rights Reserved.
//  مستوحى من: fca-unofficial-master
//
//  api.forwardMessage(messageID, threadID, callback?)
// ============================================================
"use strict";

const { generateOfflineThreadingID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function forwardMessage(messageID, threadID, callback) {
    let resolveFunc, rejectFunc;
    const returnPromise = new Promise((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc  = reject;
    });

    if (typeof callback !== "function") {
      callback = (err, data) => err ? rejectFunc(err) : resolveFunc(data);
    }

    if (!ctx.mqttClient) {
      const err = new Error("AYMAN-FCA: MQTT غير متصل");
      callback(err);
      return returnPromise;
    }

    ctx.wsReqNumber  = (ctx.wsReqNumber  || 0) + 1;
    ctx.wsTaskNumber = (ctx.wsTaskNumber || 0) + 1;

    const otid = parseInt(generateOfflineThreadingID());

    const taskPayload = {
      thread_id:                  String(threadID),
      otid,
      source:                     65544,
      send_type:                  5,
      sync_group:                 1,
      forwarded_msg_id:           String(messageID),
      strip_forwarded_msg_caption: 0,
      initiating_source:          1
    };

    const task = {
      failure_count: null,
      label:         "46",
      payload:       JSON.stringify(taskPayload),
      queue_name:    String(threadID),
      task_id:       ctx.wsTaskNumber
    };

    const content = {
      app_id:     "2220391788200892",
      payload:    JSON.stringify({
        data_trace_id: null,
        epoch_id:      parseInt(generateOfflineThreadingID()),
        tasks:         [task],
        version_id:    "25095469420099952"
      }),
      request_id: ctx.wsReqNumber,
      type:       3
    };

    ctx.mqttClient.publish("/ls_req", JSON.stringify(content), { qos: 1, retain: false }, err => {
      if (err) return callback(err);
      callback(null, { success: true, messageID, threadID });
    });

    return returnPromise;
  };
};
