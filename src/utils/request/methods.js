// ============================================================
//  AYMAN-FCA v2.0 — HTTP Methods
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const FormData           = require("form-data");
const { getHeaders }     = require("../headers");
const { client }         = require("./client");
const { cfg }            = require("./config");
const { requestWithRetry } = require("./retry");
const { getType, toStringVal, isStream, isBlobLike, isPairArrayList } = require("./helpers");

function cleanGet(url, ctx) {
  return requestWithRetry(() => client.get(url, cfg()), 3, 800, ctx);
}

function get(url, reqJar, qs, options, ctx, customHeader) {
  const headers = getHeaders(url, options, ctx, customHeader);
  return requestWithRetry(
    () => client.get(url, cfg({ reqJar, headers, params: qs })),
    3, 800, ctx
  );
}

function post(url, reqJar, form, options, ctx, customHeader) {
  const headers = getHeaders(url, options, ctx, customHeader);
  const ct = String(headers["Content-Type"] || "application/x-www-form-urlencoded").toLowerCase();
  let data;

  if (ct.includes("json")) {
    data = JSON.stringify(form || {});
    headers["Content-Type"] = "application/json";
  } else {
    const p = new URLSearchParams();
    if (form && typeof form === "object") {
      for (const k of Object.keys(form)) {
        let v = form[k];
        if (isPairArrayList(v)) {
          for (const [kk, vv] of v) p.append(`${k}[${kk}]`, toStringVal(vv));
          continue;
        }
        if (Array.isArray(v)) {
          for (const x of v) {
            if (Array.isArray(x) && x.length === 2 && typeof x[1] !== "object")
              p.append(k, toStringVal(x[1]));
            else p.append(k, toStringVal(x));
          }
          continue;
        }
        if (getType(v) === "Object") v = JSON.stringify(v);
        p.append(k, toStringVal(v));
      }
    }
    data = p.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  return requestWithRetry(
    () => client.post(url, data, cfg({ reqJar, headers })),
    3, 800, ctx
  );
}

async function postFormData(url, reqJar, form, qs, options, ctx) {
  const fd = new FormData();
  if (form && typeof form === "object") {
    for (const k of Object.keys(form)) {
      const v = form[k];
      if (v === undefined || v === null) continue;
      if (isStream(v) || Buffer.isBuffer(v) || typeof v === "string") {
        fd.append(k, v); continue;
      }
      if (isBlobLike(v)) {
        const buf = Buffer.from(await v.arrayBuffer());
        fd.append(k, buf, { filename: v.name || k, contentType: v.type || undefined });
        continue;
      }
      if (typeof v === "number" || typeof v === "boolean") {
        fd.append(k, toStringVal(v)); continue;
      }
      fd.append(k, JSON.stringify(v));
    }
  }
  const headers = { ...getHeaders(url, options, ctx), ...fd.getHeaders() };
  return requestWithRetry(
    () => client.post(url, fd, cfg({ reqJar, headers, params: qs })),
    3, 800, ctx
  );
}

module.exports = { cleanGet, get, post, postFormData };
