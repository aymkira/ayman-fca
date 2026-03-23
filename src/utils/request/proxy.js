// ============================================================
//  AYMAN-FCA v2.0 — Proxy Handler
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { HttpsProxyAgent } = require("https-proxy-agent");
const { client }          = require("./client");

function setProxy(proxyUrl) {
  if (!proxyUrl) {
    client.defaults.proxy      = false;
    client.defaults.httpAgent  = undefined;
    client.defaults.httpsAgent = undefined;
    return;
  }
  const agent = new HttpsProxyAgent(proxyUrl);
  client.defaults.proxy      = false;
  client.defaults.httpAgent  = agent;
  client.defaults.httpsAgent = agent;
}

module.exports = { setProxy };
