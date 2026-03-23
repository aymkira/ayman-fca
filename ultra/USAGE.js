// ============================================================
//  AYMAN-FCA ULTRA CORE — طريقة الاستخدام في KIRA.js
//  © 2025 Ayman. All Rights Reserved.
//
//  استبدل كامل KIRA.js بهذا الكود
// ============================================================
"use strict";

const path          = require("path");
const AymanFCAEngine= require("./ultra");          // ← مجلد ultra/
const loginLib      = require("./includes/dongdev-FCA");

// ── تحميل config ─────────────────────────────────────────────
const { readFileSync, existsSync } = require("fs-extra");
global.config = JSON.parse(readFileSync("./config.json", "utf8"));

// ── تهيئة المحرك ─────────────────────────────────────────────
const engine = new AymanFCAEngine({
  loginLib,
  appStatePath: path.resolve(global.config.APPSTATEPATH || "appstate.json"),

  // ✅ كل رسالة تصل هنا
  onMessage: (err, message) => {
    if (err) return;
    const listener = require("./includes/listen.js")({ api: engine.api, models: null });
    listener(message);
  },

  // ✅ يُستدعى عند حفظ AppState
  onSave: (state) => {
    // رفع لـ GitHub تلقائياً
    pushToGitHub(state);
  },

  loginOptions: {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  }
});

// ── ربط الأوامر بعد بدء التشغيل ──────────────────────────────
engine.on("message", (message) => {
  global.client.api = engine.api;
});

// ── بدء التشغيل ───────────────────────────────────────────────
(async () => {
  const api = await engine.start();
  global.client.api = api;

  // ✅ تحميل الأوامر والأحداث
  loadCommands(api);
  loadEvents(api);

  // ✅ إشعار التشغيل
  try {
    api.sendMessage(
      `✅ KIRA Ultra شغّال | Health: ${engine.getHealth().score}`,
      global.config.ADMINBOT[0]
    );
  } catch(_) {}

  console.log("═════════════════════════════════════");
  console.log(" KIRA ULTRA CORE — ONLINE ✅");
  console.log(`  Health:  ${engine.getHealth().score}/100`);
  console.log(`  Memory:  ${engine.getMemory().usedMB}MB`);
  console.log(`  Queue:   ${engine.getQueue().pending} pending`);
  console.log("═════════════════════════════════════");
})();

function pushToGitHub(state) {
  // نفس دالة pushAppStateToGitHub القديمة
}

function loadCommands(api) {
  // نفس كود تحميل الأوامر القديم
}

function loadEvents(api) {
  // نفس كود تحميل الأحداث القديم
}
