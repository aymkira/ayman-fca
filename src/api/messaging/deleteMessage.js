// ============================================================
//  AYMAN-FCA v2.0 — Delete Message
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { getType, generateOfflineThreadingID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function deleteMessage(messageOrMessages, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    if (getType(messageOrMessages) !== "Array") messageOrMessages = [messageOrMessages];
    if (!ctx?.mqttClient) {
      const err = new Error("AYMAN-FCA: MQTT غير متصل");
      callback(err); return reject(err);
    }

    if (typeof ctx.wsTaskNumber !== "number") ctx.wsTaskNumber = 0;
    if (typeof ctx.wsReqNumber  !== "number") ctx.wsReqNumber  = 0;

    const epochId = String(generateOfflineThreadingID());
    const tasks   = messageOrMessages.map(id => ({
      failure_count: null,
      label:         "146",
      payload:       `{"thread_key":${String(id)},"remove_type":0,"sync_group":1}`,
      queue_name:    String(id),
      task_id:       ++ctx.wsTaskNumber
    }));

    const reqID = ++ctx.wsReqNumber;
    const form  = JSON.stringify({
      app_id:     "2220391788200892",
      payload:    `{"epoch_id":${epochId},"tasks":${JSON.stringify(tasks)},"version_id":"25909428212080747"}`,
      request_id: reqID,
      type:       3
    });

    let done = false;

    const cleanup = () => {
      if (done) return; done = true;
      clearTimeout(timer);
      ctx.mqttClient?.removeListener("message", handleRes);
    };

    const handleRes = (topic, message) => {
      if (topic !== "/ls_resp") return;
      let msg;
      try { msg = JSON.parse(message.toString()); } catch { return; }
      if (msg.request_id !== reqID) return;
      cleanup();
      try { msg.payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload; } catch {}
      callback(null, { success: true }); resolve({ success: true });
    };

    ctx.mqttClient.on("message", handleRes);

    const timer = setTimeout(() => {
      cleanup();
      callback(null, { success: true }); resolve({ success: true });
    }, 15000);

    ctx.mqttClient.publish("/ls_req", form, { qos: 1, retain: false }, err => {
      if (err) { cleanup(); log.error("deleteMessage", err); callback(err); reject(err); }
    });

    return p;
  };
};
