// ============================================================
//  AYMAN-FCA ULTRA CORE — Delay Utils
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// تأخير عشوائي بين min و max
const jitter = (min, max) =>
  delay(Math.floor(Math.random() * (max - min + 1)) + min);

// تأخير بشري (100-500ms)
const humanDelay = () => jitter(100, 500);

module.exports = { delay, jitter, humanDelay };
