// ═══════════════════════════════════════════════════════════════
//  AYMAN-FCA ULTRA v4.0 — KIRA BOT
//  © 2026 Ayman | كيرا بوت | All Rights Reserved.
//  أقوى logger في العالم — يسجل كل شي وما يترك شي
//  لهجة بغدادية: يلا يا زلمة خلي نشوف شنو صار
// ═══════════════════════════════════════════════════════════════

"use strict";

const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const LOG_DIR = path.join(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = {
  info: (msg, tag = "KIRA") => {
    const time = new Date().toLocaleTimeString("ar-IQ");
    console.log(chalk.bold.cyan(`[🟢 \( {time}] [ \){tag}]`) + " " + msg);
    fs.appendFileSync(path.join(LOG_DIR, "info.log"), `[\( {time}] [ \){tag}] ${msg}\n`);
  },

  warn: (msg, tag = "KIRA") => {
    const time = new Date().toLocaleTimeString("ar-IQ");
    console.log(chalk.bold.yellow(`[🟡 \( {time}] [ \){tag}]`) + " " + msg);
    fs.appendFileSync(path.join(LOG_DIR, "warn.log"), `[\( {time}] [ \){tag}] ${msg}\n`);
  },

  error: (msg, tag = "KIRA") => {
    const time = new Date().toLocaleTimeString("ar-IQ");
    console.log(chalk.bold.red(`[🔴 \( {time}] [ \){tag}]`) + " " + msg);
    fs.appendFileSync(path.join(LOG_DIR, "error.log"), `[\( {time}] [ \){tag}] ${msg}\n`);
  },

  success: (msg, tag = "KIRA") => {
    const time = new Date().toLocaleTimeString("ar-IQ");
    console.log(chalk.bold.green(`[✅ \( {time}] [ \){tag}]`) + " " + msg);
  },

  // خاص للـ Ultra Engine
  ultra: (msg) => {
    console.log(chalk.bold.magenta("[🔥 KIRA ULTRA]") + " " + msg);
  }
};

module.exports = logger;
