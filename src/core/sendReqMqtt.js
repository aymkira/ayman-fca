// ============================================================
//  AYMAN-FCA v2.0 — Send MQTT Request
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

function sendReqMqtt(ctx, payload, options, callback) {
  return new Promise((resolve, reject) => {
    const cb      = typeof options === "function" ? options : callback;
    const opts    = typeof options === "object" && options ? options : {};

    if (!ctx?.mqttClient) {
      const err = new Error("AYMAN-FCA: MQTT غير متصل");
      if (cb) cb(err);
      return reject(err);
    }

    if (typeof ctx.wsReqNumber !== "number") ctx.wsReqNumber = 0;
    const reqID      = typeof opts.request_id === "number" ? opts.request_id : ++ctx.wsReqNumber;
    const timeoutMs  = typeof opts.timeout === "number" ? opts.timeout : 20000;
    const qos        = typeof opts.qos === "number" ? opts.qos : 1;
    const respTopic  = opts.respTopic || "/ls_resp";

    const form = JSON.stringify({
      app_id:     opts.app_id || "2220391788200892",
      payload:    typeof payload === "string" ? payload : JSON.stringify(payload),
      request_id: reqID,
      type:       opts.type ?? 3
    });

    let timer   = null;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try { if (timer) { clearTimeout(timer); timer = null; } } catch (_) {}
      try { ctx.mqttClient?.removeListener("message", handleRes); } catch (_) {}
    };

    const handleRes = (topic, message) => {
      if (topic !== respTopic) return;
      let msg;
      try { msg = JSON.parse(message.toString()); } catch { return; }
      if (msg.request_id !== reqID) return;
      if (typeof opts.filter === "function" && !opts.filter(msg)) return;
      cleanup();
      try { msg.payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload; } catch (_) {}
      const out = { success: true, response: msg.payload, raw: msg };
      if (cb) cb(null, out);
      resolve(out);
    };

    ctx.mqttClient.on("message", handleRes);

    timer = setTimeout(() => {
      cleanup();
      const err = new Error(`AYMAN-FCA: MQTT request timeout (${timeoutMs}ms)`);
      if (cb) cb(err);
      reject(err);
    }, timeoutMs);

    ctx.mqttClient.publish("/ls_req", form, { qos, retain: false }, err => {
      if (err) { cleanup(); if (cb) cb(err); reject(err); }
    });
  });
}

module.exports = sendReqMqtt;
