// ============================================================
//  AYMAN-FCA v2.0 — Remove User From Group
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { getType, generateOfflineThreadingID } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function removeUserFromGroup(userID, threadID, callback) {
    if (!ctx.mqttClient) {
      const err = new Error("AYMAN-FCA: MQTT غير متصل");
      return callback ? callback(err) : Promise.reject(err);
    }
    if (getType(threadID) !== "Number" && getType(threadID) !== "String")
      throw { error: "threadID يجب أن يكون Number أو String" };
    if (getType(userID) !== "Number" && getType(userID) !== "String")
      throw { error: "userID يجب أن يكون Number أو String" };

    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    if (typeof ctx.wsReqNumber !== "number") ctx.wsReqNumber = 0;
    const reqID = ++ctx.wsReqNumber;

    const content = {
      app_id:     "2220391788200892",
      payload:    JSON.stringify({
        epoch_id: generateOfflineThreadingID(),
        tasks: [{
          failure_count: null,
          label:         "140",
          payload:       JSON.stringify({ thread_id: threadID, contact_id: userID, sync_group: 1 }),
          queue_name:    "remove_participant_v2",
          task_id:       Math.random() * 1001 << 0
        }],
        version_id: "25002366262773827"
      }),
      request_id: reqID,
      type:       3
    };

    ctx.mqttClient.publish("/ls_req", JSON.stringify(content), { qos: 1, retain: false }, err => {
      if (err) { callback(err); reject(err); }
      else { callback(null, true); resolve(true); }
    });

    return p;
  };
};
