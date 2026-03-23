// ============================================================
//  AYMAN-FCA v2.0 — MQTT Core Connection
//  © 2025 Ayman. All Rights Reserved.
//
//  🔑 أسرار الاستمرارية في هذا الملف:
//  • UUID جديد لكل دورة اتصال (يخدع Facebook)
//  • keepalive 60s (أكثر استقراراً من 10s)
//  • connectTimeout 15s (كافٍ للشبكات البطيئة)
//  • User-Agent عشوائي في كل اتصال
//  • معالجة offline/close/error بذكاء
//  • حد أقصى 15 محاولة مع backoff تصاعدي
// ============================================================
"use strict";

const { formatID } = require("../../../utils/format");

const DEFAULT_RECONNECT_MS  = 3000;
const T_MS_WAIT_MS          = 12000;
const MAX_RECONNECT         = 15;

// ✅ من ws3: UUID جديد لكل دورة — يمنع Facebook من تتبع الجلسة
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ✅ User-Agent عشوائي لكل اتصال MQTT
const CHROME_VERSIONS = ["120.0.0.0","122.0.0.0","124.0.0.0","126.0.0.0"];
function randomUA() {
  const v = CHROME_VERSIONS[Math.floor(Math.random() * CHROME_VERSIONS.length)];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`;
}

module.exports = function createListenMqtt(deps) {
  const {
    WebSocket, mqtt, HttpsProxyAgent, buildStream, buildProxy,
    topics, parseDelta, getTaskResponseData, logger, emitAuth
  } = deps;

  return function listenMqtt(defaultFuncs, api, ctx, globalCallback) {

    if (typeof ctx._reconnectAttempts !== "number") ctx._reconnectAttempts = 0;

    function scheduleReconnect(delayMs) {
      if (ctx._reconnectTimer) return;
      if (ctx._ending) return;

      if (ctx._reconnectAttempts >= MAX_RECONNECT) {
        logger(`[ AYMAN ] MQTT وصل الحد الأقصى (${MAX_RECONNECT}) — إيقاف`, "error");
        ctx._reconnectAttempts = 0;
        globalCallback({ type: "stop_listen", error: "max_reconnect_reached" }, null);
        return;
      }

      const d  = ctx._mqttOpt?.reconnectDelayMs || DEFAULT_RECONNECT_MS;
      const ms = typeof delayMs === "number" ? delayMs : d;
      ctx._reconnectAttempts++;

      logger(`[ AYMAN ] MQTT إعادة اتصال بعد ${ms}ms (${ctx._reconnectAttempts}/${MAX_RECONNECT})`, "warn");

      ctx._reconnectTimer = setTimeout(() => {
        ctx._reconnectTimer = null;
        // ✅ UUID جديد عند كل إعادة اتصال
        ctx.clientId = generateUUID();
        if (!ctx._ending) listenMqtt(defaultFuncs, api, ctx, globalCallback);
      }, ms);
    }

    const chatOn    = ctx.globalOptions?.online ?? true;
    const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
    const ua        = randomUA();

    const username = {
      u: ctx.userID, s: sessionID, chat_on: chatOn, fg: false,
      d: ctx.clientId, ct: "websocket", aid: 219994525426954,
      aids: null, mqtt_sid: "", cp: 3, ecp: 10, st: [], pm: [],
      dc: "", no_auto_fg: true, gas: null, pack: [], p: null, php_override: ""
    };

    const cookies = api.getCookies ? api.getCookies() : "";

    let host;
    if (ctx.mqttEndpoint)
      host = `${ctx.mqttEndpoint}&sid=${sessionID}&cid=${ctx.clientId}`;
    else if (ctx.region)
      host = `wss://edge-chat.facebook.com/chat?region=${ctx.region.toLowerCase()}&sid=${sessionID}&cid=${ctx.clientId}`;
    else
      host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}&cid=${ctx.clientId}`;

    const options = {
      clientId:        "mqttwsclient",
      protocolId:      "MQIsdp",
      protocolVersion: 3,
      username:        JSON.stringify(username),
      clean:           true,
      wsOptions: {
        headers: {
          Cookie:                   cookies,
          Origin:                   "https://www.facebook.com",
          "User-Agent":             ua,
          Referer:                  "https://www.facebook.com/",
          Host:                     "edge-chat.facebook.com",
          Connection:               "Upgrade",
          Pragma:                   "no-cache",
          "Cache-Control":          "no-cache",
          Upgrade:                  "websocket",
          "Sec-WebSocket-Version":  "13",
          "Accept-Encoding":        "gzip, deflate, br",
          "Accept-Language":        "ar,en-US;q=0.9,en;q=0.8",
          "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits"
        },
        origin:          "https://www.facebook.com",
        protocolVersion: 13,
        binaryType:      "arraybuffer",
        handshakeTimeout: 15000
      },
      // ✅ keepalive 60s — أكثر استقراراً
      keepalive:       60,
      reschedulePings: true,
      reconnectPeriod: 0,
      connectTimeout:  15000
    };

    if (ctx.globalOptions?.proxy) {
      options.wsOptions.agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
    }

    ctx.mqttClient = new mqtt.Client(
      () => buildStream(options, new WebSocket(host, options.wsOptions), buildProxy()),
      options
    );
    const mqttClient = ctx.mqttClient;

    // ─── Error ───────────────────────────────────────────────
    mqttClient.on("error", function(err) {
      const msg = String(err?.message || err || "");

      if ((ctx._ending || ctx._cycling) && /No subscription existed|client disconnecting/i.test(msg)) return;

      if (/Not logged in|blocked the login|401|403/i.test(msg)) {
        try { if (mqttClient?.connected) mqttClient.end(true); } catch (_) {}
        return emitAuth(ctx, api, globalCallback, /blocked/i.test(msg) ? "login_blocked" : "not_logged_in", msg);
      }

      logger(`[ AYMAN ] MQTT خطأ: ${msg}`, "error");
      try { if (mqttClient?.connected) mqttClient.end(true); } catch (_) {}
      if (ctx._ending || ctx._cycling) return;
      if (ctx.globalOptions?.autoReconnect !== false) scheduleReconnect();
      else globalCallback({ type: "stop_listen", error: msg }, null);
    });

    // ─── Connect ─────────────────────────────────────────────
    mqttClient.on("connect", function() {
      ctx._reconnectAttempts = 0;

      if (!process.env.AymanFcaOnline) {
        logger("[ AYMAN-FCA ] KIRA متصل بـ Facebook ✅", "info");
        process.env.AymanFcaOnline = "1";
      }
      ctx._cycling = false;

      topics.forEach(t => mqttClient.subscribe(t));

      const queue = {
        sync_api_version: 11, max_deltas_able_to_process: 100,
        delta_batch_size: 500, encoding: "JSON",
        entity_fbid: ctx.userID,
        initial_titan_sequence_id: ctx.lastSeqId,
        device_params: null
      };
      const topic = ctx.syncToken ? "/messenger_sync_get_diffs" : "/messenger_sync_create_queue";
      if (ctx.syncToken) { queue.last_seq_id = ctx.lastSeqId; queue.sync_token = ctx.syncToken; }

      mqttClient.publish(topic, JSON.stringify(queue), { qos: 1, retain: false });
      mqttClient.publish("/foreground_state", JSON.stringify({ foreground: chatOn }), { qos: 1 });
      mqttClient.publish("/set_client_settings", JSON.stringify({ make_user_available_when_in_foreground: true }), { qos: 1 });

      // ✅ T_MS_WAIT timeout
      let rTimeout = setTimeout(() => {
        rTimeout = null;
        if (ctx._ending) return;
        logger("[ AYMAN ] MQTT t_ms timeout — إعادة اتصال", "warn");
        try { if (mqttClient?.connected) mqttClient.end(true); } catch (_) {}
        scheduleReconnect();
      }, T_MS_WAIT_MS);

      ctx._rTimeout = rTimeout;
      ctx.tmsWait = function() {
        if (rTimeout) { clearTimeout(rTimeout); rTimeout = null; }
        if (ctx._rTimeout) delete ctx._rTimeout;
        if (ctx.globalOptions?.emitReady) globalCallback({ type: "ready", error: null });
        delete ctx.tmsWait;
      };
    });

    // ─── Message ─────────────────────────────────────────────
    mqttClient.on("message", function(topic, message) {
      if (ctx._ending) return;
      try {
        let j = Buffer.isBuffer(message) ? Buffer.from(message).toString() : message;
        try { j = JSON.parse(j); } catch { j = {}; }

        if (j.type === "jewel_requests_add") {
          globalCallback(null, { type: "friend_request_received", actorFbId: j.from.toString(), timestamp: Date.now().toString() });
        } else if (j.type === "jewel_requests_remove_old") {
          globalCallback(null, { type: "friend_request_cancel", actorFbId: j.from.toString(), timestamp: Date.now().toString() });
        } else if (topic === "/t_ms") {
          if (ctx.tmsWait) ctx.tmsWait();
          if (j.firstDeltaSeqId && j.syncToken) { ctx.lastSeqId = j.firstDeltaSeqId; ctx.syncToken = j.syncToken; }
          if (j.lastIssuedSeqId) ctx.lastSeqId = parseInt(j.lastIssuedSeqId);
          for (const dlt of (j.deltas || [])) parseDelta(defaultFuncs, api, ctx, globalCallback, { delta: dlt });
        } else if (topic === "/thread_typing" || topic === "/orca_typing_notifications") {
          globalCallback(null, {
            type: "typ", isTyping: !!j.state,
            from: j.sender_fbid.toString(),
            threadID: formatID((j.thread || j.sender_fbid).toString())
          });
        } else if (topic === "/orca_presence") {
          if (!ctx.globalOptions?.updatePresence) {
            for (const d of (j.list || [])) {
              globalCallback(null, { type: "presence", userID: String(d.u), timestamp: d.l * 1000, statuses: d.p });
            }
          }
        } else if (topic === "/ls_resp") {
          try {
            const parsed = JSON.parse(j.payload);
            const reqID  = j.request_id;
            if (ctx.tasks instanceof Map && ctx.tasks.has(reqID)) {
              const { type: taskType, callback: cb } = ctx.tasks.get(reqID);
              const data = getTaskResponseData(taskType, parsed);
              cb(data == null ? "error" : null, data == null ? null : Object.assign({ type: taskType, reqID }, data));
            }
          } catch (_) {}
        }
      } catch (ex) {
        logger(`[ AYMAN ] MQTT رسالة خاطئة: ${ex?.message || ex}`, "error");
      }
    });

    // ─── Close / Offline / Disconnect ────────────────────────
    mqttClient.on("close", function() {
      if (ctx._ending || ctx._cycling) return;
      logger("[ AYMAN ] MQTT انقطع — إعادة اتصال", "warn");
      if (ctx.globalOptions?.autoReconnect !== false && !ctx._reconnectTimer) scheduleReconnect();
    });

    mqttClient.on("offline", () => {
      if (ctx._ending) return;
      logger("[ AYMAN ] MQTT offline — الشبكة منقطعة", "warn");
    });

    mqttClient.on("disconnect", () => {
      if (ctx._ending || ctx._cycling) return;
      logger("[ AYMAN ] MQTT disconnect", "warn");
    });
  };
};
