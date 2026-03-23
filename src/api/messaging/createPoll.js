// ============================================================
//  AYMAN-FCA v2.0 — Create Poll
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { generateOfflineThreadingID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function createPoll(threadID, questionText, options, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    if (!ctx.mqttClient) {
      const err = new Error("AYMAN-FCA: MQTT غير متصل");
      callback(err); return p;
    }
    if (!questionText) return callback(new Error("questionText مطلوب"));
    if (!Array.isArray(options) || !options.length) return callback(new Error("options مطلوب"));

    const form = JSON.stringify({
      app_id:     "2220391788200892",
      payload:    JSON.stringify({
        epoch_id:   generateOfflineThreadingID(),
        tasks: [{
          failure_count: null,
          label:         "163",
          payload:       JSON.stringify({
            question_text: questionText,
            thread_key:    threadID,
            options,
            sync_group:    1
          }),
          queue_name:    "poll_creation",
          task_id:       Math.floor(Math.random() * 1001)
        }],
        version_id: "34195258046739157"
      }),
      request_id: ++ctx.wsReqNumber,
      type:       3
    });

    ctx.mqttClient.publish("/ls_req", form, { qos: 1, retain: false }, err => {
      if (err) return callback(err);
      callback(null, { success: true, threadID, question: questionText });
      resolve({ success: true });
    });

    return p;
  };
};
