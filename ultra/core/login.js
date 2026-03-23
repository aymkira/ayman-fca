// ============================================================
//  AYMAN-FCA ULTRA CORE — Login
//  © 2025 Ayman. All Rights Reserved.
//
//  ✅ AppState فقط — ممنوع email/password
//  ✅ قراءة AppState دائماً من القرص (لا الذاكرة)
//  ✅ يتوقف فوراً إذا لا يوجد appstate صالح
// ============================================================
"use strict";

const fs     = require("fs");
const path   = require("path");
const logger = require("./logger");
const { isValidAppState } = require("../utils/validator");
const { retry } = require("../utils/retry");

function loadAppState(filePath) {
  const candidates = [
    filePath,
    filePath.replace(".json", ".backup.json"),
    path.join(path.dirname(filePath), "session_backups")
  ];

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const stat = fs.statSync(p);

      // إذا مجلد backups
      if (stat.isDirectory()) {
        const files = fs.readdirSync(p)
          .filter(f => f.endsWith(".json"))
          .sort().reverse();
        for (const f of files) {
          const raw   = JSON.parse(fs.readFileSync(path.join(p, f), "utf8"));
          if (isValidAppState(raw)) { logger.info(`Login: AppState من backup: ${f}`, "LOGIN"); return raw; }
        }
        continue;
      }

      // ملف عادي
      delete require.cache[p]; // لا تعتمد على require cache
      const raw = JSON.parse(fs.readFileSync(p, "utf8"));
      if (isValidAppState(raw)) return raw;
    } catch(_) {}
  }

  return null;
}

async function login(loginLib, appStatePath, options = {}) {
  const state = loadAppState(appStatePath);

  if (!state) {
    logger.error("Login: ❌ لا يوجد AppState صالح — توقف", "LOGIN");
    process.exit(1);
  }

  logger.info(`Login: AppState محمّل (${state.length} cookies) ✅`, "LOGIN");

  const loginOptions = {
    listenEvents:     true,
    logLevel:         "silent",
    pauseLog:         true,
    selfListen:       false,
    autoMarkRead:     false,
    autoMarkDelivery: false,
    updatePresence:   true,
    online:           true,
    autoReconnect:    true,
    forceLogin:       false,
    userAgent:        options.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ...options
  };

  return await retry(
    () => new Promise((resolve, reject) => {
      loginLib({ appState: state }, loginOptions, (err, api) => {
        if (err) return reject(err);
        resolve(api);
      });
    }),
    {
      delays: [3000, 5000, 10000, 20000, 30000],
      tag: "LOGIN",
      predicate: (err) => {
        const msg = String(err?.message || err?.error || "");
        // لا تعيد المحاولة عند block
        return !/blocked|checkpoint|login_blocked/i.test(msg);
      }
    }
  );
}

module.exports = { login, loadAppState };
