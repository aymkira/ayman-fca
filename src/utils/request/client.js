// ============================================================
//  AYMAN-FCA v2.0 — HTTP Client
//  © 2025 Ayman. All Rights Reserved.
//
//  ملاحظة مهمة: لا نستخدم httpAgent/httpsAgent مخصص
//  لأن axios-cookiejar-support لا يدعمه
// ============================================================
"use strict";

const axios   = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const jar = new CookieJar();

// ✅ Client نظيف — timeout 30s أسرع من الافتراضي 60s
const client = wrapper(
  axios.create({
    jar,
    withCredentials: true,
    timeout: 30000,
    validateStatus: s => s >= 200 && s < 600,
    maxRedirects: 5,
    maxContentLength: Infinity,
    maxBodyLength:    Infinity,
    decompress: true
  })
);

// ✅ delay utility
const delay = ms => new Promise(r => setTimeout(r, ms));

module.exports = { jar, client, delay };
