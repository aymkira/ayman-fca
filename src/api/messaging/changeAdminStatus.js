// ============================================================
//  AYMAN-FCA v2.0 — Change Admin Status
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { generateOfflineThreadingID, getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {

  function buildTasks(threadID, adminID, adminStatus) {
    const ids    = getType(adminID) === "Array" ? adminID : [adminID];
    const isAdm  = adminStatus ? 1 : 0;
    return ids.map((id, i) => ({
      failure_count: null,
      label:         "25",
      payload:       JSON.stringify({ thread_key: threadID, contact_id: id, is_admin: isAdm }),
      queue_name:    "admin_status",
      task_id:       i + 1
    }));
  }

  function viaMqtt(threadID, adminID, adminStatus) {
    if (!ctx.mqttClient) throw new Error("AYMAN-FCA: MQTT غير متصل");
    if (typeof ctx.wsReqNumber !== "number") ctx.wsReqNumber = 0;
    const reqID = ++ctx.wsReqNumber;
    const form  = JSON.stringify({
      app_id:     "2220391788200892",
      payload:    JSON.stringify({
        epoch_id:   generateOfflineThreadingID(),
        tasks:      buildTasks(threadID, adminID, adminStatus),
        version_id: "8798795233522156"
      }),
      request_id: reqID,
      type:       3
    });
    return new Promise((resolve, reject) => {
      ctx.mqttClient.publish("/ls_req", form, { qos: 1, retain: false }, err =>
        err ? reject(err) : resolve({ success: true })
      );
    });
  }

  function viaHttp(threadID, adminID, adminStatus) {
    if (typeof ctx.wsReqNumber !== "number") ctx.wsReqNumber = 0;
    const reqID = ++ctx.wsReqNumber;
    const form  = JSON.stringify({
      app_id:     "772021112871879",
      payload:    JSON.stringify({
        epoch_id:      generateOfflineThreadingID(),
        tasks:         buildTasks(threadID, adminID, adminStatus),
        data_trace_id: null
      }),
      request_id: reqID,
      type:       3
    });
    return new Promise((resolve, reject) => {
      if (!ctx.mqttClient) return reject(new Error("AYMAN-FCA: MQTT غير متصل"));
      ctx.mqttClient.publish("/ls_req", form, {}, err =>
        err ? reject(err) : resolve()
      );
    });
  }

  return function changeAdminStatus(threadID, adminID, adminStatus) {
    if (ctx.mqttClient) {
      try { return viaMqtt(threadID, adminID, adminStatus); }
      catch (_) { return viaHttp(threadID, adminID, adminStatus); }
    }
    return viaHttp(threadID, adminID, adminStatus);
  };
};
