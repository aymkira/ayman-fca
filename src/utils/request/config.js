// ============================================================
//  AYMAN-FCA v2.0 — Request Config
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { sanitizeHeaders } = require("./sanitize");
const { jar }             = require("./client");

function cfg(base = {}) {
  const { reqJar, headers, params, agent, timeout } = base;
  return {
    headers:         sanitizeHeaders(headers),
    params,
    jar:             reqJar || jar,
    withCredentials: true,
    timeout:         timeout || 30000,
    ...(agent ? { httpAgent: agent, httpsAgent: agent } : {}),
    proxy:           false,
    validateStatus:  s => s >= 200 && s < 600,
    decompress:      true
  };
}

module.exports = { cfg };
