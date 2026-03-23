// ============================================================
//  AYMAN-FCA ULTRA CORE — Structured Logger
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const fs   = require("fs");
const path = require("path");
const { LOG_LEVELS, MAX_LOG_SIZE_MB } = require("../system/constants");

const LOG_DIR  = path.join(process.cwd(), "logs");
const MAX_BYTES= MAX_LOG_SIZE_MB * 1024 * 1024;

let _level   = "info";
let _streams = {};

function ensureDir() {
  try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); }
  catch(_) {}
}

function getStream(name) {
  if (_streams[name]) return _streams[name];
  ensureDir();
  const file = path.join(LOG_DIR, `${name}.log`);
  // ✅ rotate إذا تجاوز الحجم
  try {
    const stat = fs.existsSync(file) && fs.statSync(file);
    if (stat && stat.size > MAX_BYTES) {
      fs.renameSync(file, file.replace(".log", `_${Date.now()}.log`));
    }
  } catch(_) {}
  _streams[name] = fs.createWriteStream(file, { flags: "a" });
  return _streams[name];
}

function format(level, tag, msg) {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] ${tag ? `[${tag}]` : ""} ${msg}\n`;
}

function write(level, tag, msg) {
  if (LOG_LEVELS[level] < LOG_LEVELS[_level]) return;
  const line = format(level, tag, msg);

  // Console
  if (level === "error") process.stderr.write(line);
  else process.stdout.write(line);

  // File
  try { getStream("ayman-fca").write(line); } catch(_) {}
  if (level === "error") {
    try { getStream("errors").write(line); } catch(_) {}
  }
}

const logger = {
  setLevel: (l) => { _level = l; },
  debug: (msg, tag) => write("debug", tag, msg),
  info:  (msg, tag) => write("info",  tag, msg),
  warn:  (msg, tag) => write("warn",  tag, msg),
  error: (msg, tag) => write("error", tag, msg),
  log:   (msg, tag) => write("info",  tag, msg)
};

module.exports = logger;
