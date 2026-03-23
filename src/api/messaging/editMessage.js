// ============================================================
//  AYMAN-FCA v2.0 — Edit Message
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { generateOfflineThreadingID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function editMessage(text, messageID, callback) {
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
          label:         "742",
          payload:       JSON.stringify({ message_id: messageID, text }),
          queue_name:    "edit_message",
          task_id:       ++ctx.wsTaskNumber
        }],
        version_id: "6903494529735864"
      }),
      request_id: reqID,
      type:       3
    };

    let done = false;
    const timer = setTimeout(() => {
      if (done) return; done = true;
      ctx.mqttClient?.removeListener("message", handleRes);
      callback(null, { success: true });
    }, 10000);

    const handleRes = (topic, message) => {
      if (topic !== "/ls_resp") return;
      let msg;
      try { msg = JSON.parse(message.toString()); msg.payload = JSON.parse(msg.payload); } catch { return; }
      if (msg.request_id !== reqID) return;
      if (done) return; done = true;
      clearTimeout(timer);
      ctx.mqttClient?.removeListener("message", handleRes);
      try {
        const msgID     = msg.payload.step?.[1]?.[2]?.[2]?.[1]?.[2];
        const msgReplace= msg.payload.step?.[1]?.[2]?.[2]?.[1]?.[4];
        const bodies    = { body: msgReplace, messageID: msgID };
        if (msgReplace !== text) return callback({ error: "الرسالة قديمة أو ليست منك" }, bodies);
        callback(null, bodies); resolve(bodies);
      } catch {
        callback(null, { success: true }); resolve({ success: true });
      }
    };

    ctx.mqttClient.on("message", handleRes);
    ctx.mqttClient.publish("/ls_req", JSON.stringify(content), { qos: 1, retain: false });
    return p;
  };
};
