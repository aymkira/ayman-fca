// ============================================================
//  AYMAN-FCA v2.0 — Request Defaults Builder
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const constMod = require("../constants");
const getFrom  = constMod.getFrom;
const { get, post, postFormData } = require("./methods");

function makeDefaults(html, userID, ctx) {
  let reqCounter = 1;
  const revision =
    getFrom(html || "", 'revision":', ",") ||
    getFrom(html || "", '"client_revision":', ",") || "";

  function merge(obj) {
    const base = {
      av:     userID,
      __user: userID,
      __req:  (reqCounter++).toString(36),
      __rev:  revision,
      __a:    1,
    };
    if (ctx?.fb_dtsg)  base.fb_dtsg  = ctx.fb_dtsg;
    if (ctx?.jazoest)  base.jazoest  = ctx.jazoest;
    if (!obj) return base;
    for (const k of Object.keys(obj)) if (!(k in base)) base[k] = obj[k];
    return base;
  }

  return {
    get:         (url, j, qs, ctxx, h = {}) => get(url, j, merge(qs), ctx?.globalOptions, ctxx || ctx, h),
    post:        (url, j, form, ctxx, h = {}) => post(url, j, merge(form), ctx?.globalOptions, ctxx || ctx, h),
    postFormData:(url, j, form, qs, ctxx) =>
      postFormData(url, j, merge(form), merge(qs), ctx?.globalOptions, ctxx || ctx),
  };
}

module.exports = { makeDefaults };
