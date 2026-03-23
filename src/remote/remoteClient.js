// ============================================================
//  AYMAN-FCA v2.0 — Remote Client (معطل افتراضياً)
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const WebSocket = require("ws");
const logger    = require("../../func/logger");

function createRemoteClient(api, ctx, cfg) {
  if (!cfg || !cfg.enabled || !cfg.url) return null;

  const url          = String(cfg.url);
  const token        = cfg.token ? String(cfg.token) : null;
  const autoReconnect= cfg.autoReconnect !== false;
  const emitter      = ctx?._emitter;

  let ws             = null;
  let closed         = false;
  let reconnectTimer = null;

  const log = (msg, level = "info") => logger(`[remote] ${msg}`, level);

  function safeEmit(event, payload) {
    try { if (emitter?.emit) emitter.emit(event, payload); } catch (_) {}
  }

  function scheduleReconnect() {
    if (!autoReconnect || closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; if (!closed) connect(); }, 5000);
  }

  function connect() {
    try {
      ws = new WebSocket(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    } catch (e) {
      log(`connect error: ${e?.message || e}`, "warn");
      scheduleReconnect(); return;
    }

    ws.on("open", () => {
      log("متصل ✅");
      try { ws.send(JSON.stringify({ type: "hello", userID: ctx?.userID, region: ctx?.region })); } catch (_) {}
      safeEmit("remote:connected", {});
    });

    ws.on("message", data => {
      try {
        const msg = JSON.parse(data.toString());
        safeEmit("remote:message", msg);
        if (msg.type === "api" && msg.method && typeof api[msg.method] === "function") {
          try { api[msg.method](...(msg.args || [])); } catch (e) {
            log(`api call error: ${e?.message}`, "warn");
          }
        }
      } catch (_) {}
    });

    ws.on("error", e => { log(`error: ${e?.message || e}`, "warn"); });
    ws.on("close", () => { log("انقطع الاتصال", "warn"); safeEmit("remote:disconnected", {}); scheduleReconnect(); });
  }

  connect();

  return {
    send: (data) => { try { if (ws?.readyState === 1) ws.send(JSON.stringify(data)); } catch (_) {} },
    close: () => { closed = true; if (reconnectTimer) clearTimeout(reconnectTimer); try { ws?.close(); } catch (_) {} }
  };
}

module.exports = { createRemoteClient };
