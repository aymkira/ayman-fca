// ============================================================
//  AYMAN-FCA v2.0 — Refresh fb_dtsg
//  © 2025 Ayman. All Rights Reserved.
//
//  تجديد تلقائي كل 6 ساعات + retry 3 مرات عند الفشل
// ============================================================
"use strict";

const { getFrom } = require("../../utils/constants");
const { get }     = require("../../utils/request");
const { getType } = require("../../utils/format");
const logger      = require("../../../func/logger");

module.exports = function(defaultFuncs, api, ctx) {

  // ✅ تجديد تلقائي كل 6 ساعات
  if (ctx._fbDtsgInterval) clearInterval(ctx._fbDtsgInterval);
  ctx._fbDtsgInterval = setInterval(async () => {
    try {
      await api.refreshFb_dtsg();
      logger("[ AYMAN ] fb_dtsg مجدد تلقائياً ✅", "info");
    } catch (_) {}
  }, 6 * 60 * 60 * 1000);

  return function refreshFb_dtsg(obj, callback) {
    if (typeof obj === "function") { callback = obj; obj = {}; }
    if (!obj || getType(obj) !== "Object") obj = {};

    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    if (!callback) callback = (err, data) => err ? reject(err) : resolve(data);

    if (Object.keys(obj).length === 0) {
      // ✅ 3 محاولات عند الفشل
      const tryRefresh = async (attempt = 0) => {
        try {
          const res  = await get("https://www.facebook.com/", ctx.jar, null, ctx.globalOptions, { noRef: true });
          const html = res?.data || "";
          const dtsg = getFrom(html, '["DTSGInitData",[],{"token":"', '","');
          const jaz  = getFrom(html, "jazoest=", '",');

          if (!dtsg) {
            if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); return tryRefresh(attempt + 1); }
            throw new Error("[ AYMAN ] لم يُعثر على fb_dtsg بعد 3 محاولات");
          }

          Object.assign(ctx, { fb_dtsg: dtsg, ...(jaz ? { jazoest: jaz } : {}) });
          callback(null, { data: { fb_dtsg: dtsg, jazoest: jaz }, message: "تم تجديد fb_dtsg ✅" });
        } catch (err) {
          if (attempt < 2) { await new Promise(r => setTimeout(r, 2000)); return tryRefresh(attempt + 1); }
          callback(err);
        }
      };
      tryRefresh();
    } else {
      Object.assign(ctx, obj);
      callback(null, { data: obj, message: `تم تجديد: ${Object.keys(obj).join(", ")}` });
    }

    return p;
  };
};
