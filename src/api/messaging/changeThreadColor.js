// ============================================================
//  AYMAN-FCA v2.0 — Change Thread Color
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { generateOfflineThreadingID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function changeThreadColor(color, threadID, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    if (!ctx.mqttClient) return callback(new Error("AYMAN-FCA: MQTT غير متصل"));

    const reqID = ++ctx.wsReqNumber;
    const content = {
      app_id:     "2220391788200892",
      payload:    JSON.stringify({
        data_trace_id: null,
        epoch_id:      parseInt(generateOfflineThreadingID()),
        tasks: [{
          failure_count: null,
          label:         "43",
          payload:       JSON.stringify({ thread_key: threadID, theme_fbid: color, source: null, sync_group: 1, payload: null }),
          queue_name:    "thread_theme",
          task_id:       ++ctx.wsTaskNumber
        }],
        version_id: "8798795233522156"
      }),
      request_id: reqID,
      type:       3
    };

    ctx.mqttClient.publish("/ls_req", JSON.stringify(content), { qos: 1, retain: false }, err => {
      if (err) return callback(err);
      callback(null, { success: true, color, threadID });
      resolve({ success: true });
    });

    return p;
  };
};
