// ============================================================
//  AYMAN-FCA v2.0 — Smart Headers + Random User-Agent
//  © 2025 Ayman. All Rights Reserved.
//  مستوحى من: ws3-fca | مطوَّر بالكامل بواسطة أيمن
//
//  السر الأول لاستمرارية الجلسة:
//  كل request يستخدم User-Agent مختلف لتجنب كشف البوت
// ============================================================
"use strict";

// ✅ قائمة Chrome versions حقيقية لتغيير عشوائي
const CHROME_VERSIONS = [
  "120.0.0.0","121.0.0.0","122.0.0.0","123.0.0.0",
  "124.0.0.0","125.0.0.0","126.0.0.0","127.0.0.0"
];

const PLATFORMS = [
  { os: "Windows NT 10.0; Win64; x64",          platform: "Windows", version: '"15.0.0"' },
  { os: "Macintosh; Intel Mac OS X 10_15_7",    platform: "macOS",   version: '"13.6.0"' },
  { os: "X11; Linux x86_64",                    platform: "Linux",   version: '"6.1.0"'  }
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ✅ يُولّد User-Agent + Sec-CH headers حقيقية عشوائية
function randomUserAgent() {
  const platform = getRandom(PLATFORMS);
  const version  = getRandom(CHROME_VERSIONS);
  const major    = version.split(".")[0];

  const userAgent = `Mozilla/5.0 (${platform.os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;

  const secChUa = `"Not/A)Brand";v="8", "Chromium";v="${major}", "Google Chrome";v="${major}"`;

  return {
    userAgent,
    secChUa,
    secChUaPlatform:        `"${platform.platform}"`,
    secChUaPlatformVersion: platform.version,
    secChUaMobile:          "?0"
  };
}

// ✅ Headers شاملة تُحاكي المتصفح الحقيقي
function getHeaders(url, options, ctx, customHeader) {
  let host;
  try { host = new URL(url).hostname; } catch { host = "www.facebook.com"; }

  const { userAgent, secChUa, secChUaPlatform, secChUaPlatformVersion, secChUaMobile }
    = randomUserAgent();

  const ua = options?.userAgent || ctx?.globalOptions?.userAgent || userAgent;

  const headers = {
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding":           "gzip, deflate, br",
    "Accept-Language":           "ar,en-US;q=0.9,en;q=0.8",
    "Cache-Control":             "max-age=0",
    "Connection":                "keep-alive",
    "Content-Type":              "application/x-www-form-urlencoded",
    "Host":                      host,
    "Origin":                    `https://${host}`,
    "Referer":                   `https://${host}/`,
    "Sec-Ch-Ua":                 secChUa,
    "Sec-Ch-Ua-Mobile":          secChUaMobile,
    "Sec-Ch-Ua-Platform":        secChUaPlatform,
    "Sec-Ch-Ua-Platform-Version": secChUaPlatformVersion,
    "Sec-Fetch-Dest":            "document",
    "Sec-Fetch-Mode":            "navigate",
    "Sec-Fetch-Site":            "same-origin",
    "Sec-Fetch-User":            "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":                ua,
    "Viewport-Width":            "1920",
    "Dpr":                       "1"
  };

  // ✅ إضافة رؤوس المنطقة لتسريع الاتصال
  if (ctx?.region) {
    headers["X-MSGR-Region"] = ctx.region;
  }

  // ✅ merge custom headers
  if (customHeader && typeof customHeader === "object") {
    for (const [k, v] of Object.entries(customHeader)) {
      if (k !== "noRef") headers[k] = v;
    }
    if (customHeader.noRef) delete headers["Referer"];
  }

  return headers;
}

module.exports = { getHeaders, randomUserAgent };
