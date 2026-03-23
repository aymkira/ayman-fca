// ============================================================
//  AYMAN-FCA v2.0 — Set Thread Title
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const log = require("../../../func/logAdapter");
const { generateOfflineThreadingID, getType } = require("../../utils/format");
const { parseAndCheckLogin } = require("../../utils/client");

module.exports = function(defaultFuncs, api, ctx) {

  function setTitleMqtt(newTitle, threadID, callback) {
    if (!ctx.mqttClient) throw new Error("AYMAN-FCA: MQTT غير متصل");
    if (typeof ctx.wsReqNumber !== "number") ctx.wsReqNumber = 0;
    const reqID = ++ctx.wsReqNumber;

    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    const done = (err, data) => {
      if (callback) callback(err, data);
      err ? reject(err) : resolve(data);
    };

    const form = JSON.stringify({
      app_id:     "2220391788200892",
      payload:    JSON.stringify({
        epoch_id:   generateOfflineThreadingID(),
        tasks: [{
          failure_count: null,
          label:         "32",
          payload:       JSON.stringify({ thread_key: threadID, thread_name: newTitle, sync_group: 1 }),
          queue_name:    String(threadID),
          task_id:       Math.random() * 1001 << 0
        }],
        version_id: "8798795233522156"
      }),
      request_id: reqID,
      type:       3
    });

    ctx.mqttClient.publish("/ls_req", form, { qos: 1, retain: false }, err => {
      if (err) return done(err);
      done(null, { success: true });
    });
    return p;
  }

  function setTitleHttp(newTitle, threadID, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    callback = callback || (err => err ? reject(err) : resolve());

    const form = {
      client:            "mercury",
      action_type:       "ma-type:log-message",
      author:            `fbid:${ctx.userID}`,
      timestamp:         Date.now(),
      offline_threading_id: generateOfflineThreadingID(),
      thread_fbid:       threadID,
      thread_name:       newTitle,
      thread_id:         threadID,
      log_message_type:  "log:thread-name"
    };

    defaultFuncs.post("https://www.facebook.com/messaging/set_thread_name/", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(res => {
        if (res.error === 1545012) throw { error: "لا يمكن تغيير العنوان: لست عضواً في المحادثة" };
        if (res.error === 1545003) throw { error: "لا يمكن تغيير عنوان محادثة فردية" };
        if (res.error) throw res;
        callback();
      })
      .catch(err => { log.error("setTitle", err); callback(err); });

    return p;
  }

  return function setTitle(newTitle, threadID, callback) {
    if (ctx.mqttClient) {
      try { return setTitleMqtt(newTitle, threadID, callback); }
      catch (_) { return setTitleHttp(newTitle, threadID, callback); }
    }
    return setTitleHttp(newTitle, threadID, callback);
  };
};
