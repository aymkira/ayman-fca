// ============================================================
//  AYMAN-FCA v2.0 — Config Loader
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const fs     = require("fs");
const path   = require("path");
const logger = require("../func/logger");

const defaultConfig = {
  autoUpdate:   false,
  autoLogin:    false,
  apiServer:    "",
  apiKey:       "",
  credentials:  { email: "", password: "", twofactor: "" },
  mqtt:         { enabled: true, reconnectInterval: 3600 },
  antiGetInfo:  { AntiGetThreadInfo: false, AntiGetUserInfo: false },
  remoteControl:{ enabled: false, url: "", token: "", autoReconnect: true }
};

function loadConfig() {
  const configPath = path.join(process.cwd(), "fca-config.json");
  let config;
  if (!fs.existsSync(configPath)) {
    config = defaultConfig;
  } else {
    try {
      config = Object.assign({}, defaultConfig, JSON.parse(fs.readFileSync(configPath, "utf8")));
    } catch (err) {
      logger(`[ AYMAN ] خطأ في قراءة fca-config.json: ${err.message}`, "error");
      config = defaultConfig;
    }
  }
  return { config, configPath };
}

module.exports = { loadConfig, defaultConfig };
