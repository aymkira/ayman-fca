// ============================================================
//  AYMAN-FCA v2.0 — Refresh fb_dtsg [FIXED]
//  © 2025 Ayman. All Rights Reserved.
//
//  الإصلاحات:
//  ✅ Interval من 6 ساعات → 90 دقيقة (fb_dtsg يحتاج تجديد أكثر)
//  ✅ تجديد lsd أيضاً (كان مفقوداً)
//  ✅ حفظ AppState بعد كل تجديد ناجح
//  ✅ فحص أن المكتبة لا تزال متصلة قبل التجديد
// ============================================================
"use strict";

const { getFrom } = require("../../utils/constants");
const { get }     = require("../../utils/request");
const { getType } = require("../../utils/format");
const logger      = require("../../../func/logger");
const fs          = require("fs");
const path        = require("path");

// ✅ كان 6 ساعات — مخفض إلى 90 دقيقة للاستقرار
const REFRESH_INTERVAL_MS = 90 * 60 * 1000;

function saveAppState(api) {
  try {
    if (!api?.getAppState) return;
    const state = api.getAppState();
    if (!state || !state.length) return;
    const file = path.join(process.cwd(), "appstate.json");
    const tmp  = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, "\t"), "utf8");
    fs.renameSync(tmp, file);
  } catch (_) {}
}

module.exports = function(defaultFuncs, api, ctx) {

  // ✅ إلغاء أي interval سابق قبل إنشاء جديد
  if (ctx._fbDtsgInterval) {
    clearInterval(ctx._fbDtsgInterval);
    ctx._fbDtsgInterval = null;
  }

  // ✅ تجديد تلقائي كل 90 دقيقة
  ctx._fbDtsgInterval = setInterval(async () => {
    try {
      // لا تجدد إذا كان MQTT منقطعاً (لا فائدة)
      if (!ctx.mqttClient?.connected && !ctx.jar) return;
      await api.refreshFb_dtsg();
      logger("[ AYMAN ] fb_dtsg مجدد تلقائياً ✅", "info");
      // حفظ appstate بعد كل تجديد ناجح
      saveAppState(api);
    } catch (_) {}
  }, REFRESH_INTERVAL_MS);

  return function refreshFb_dtsg(obj, callback) {
    if (typeof obj === "function") { callback = obj; obj = {}; }
    if (!obj || getType(obj) !== "Object") obj = {};

    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });
    if (!callback) callback = (err, data) => err ? reject(err) : resolve(data);

    if (Object.keys(obj).length === 0) {
      // ✅ 3 محاولات مع تأخير تصاعدي
      const tryRefresh = async (attempt = 0) => {
        try {
          const res  = await get("https://www.facebook.com/", ctx.jar, null, ctx.globalOptions, { noRef: true });
          const html = res?.data || "";

          // ✅ استخراج fb_dtsg
          const dtsg = getFrom(html, '["DTSGInitData",[],{"token":"', '",')
                    || getFrom(html, '"token":"',               '","ttl"');
          // ✅ استخراج jazoest
          const jaz  = getFrom(html, "jazoest=", "&")
                    || getFrom(html, 'name="jazoest" value="', '"');
          // ✅ استخراج lsd (مُضاف جديد)
          const lsd  = getFrom(html, '["LSD",[],{"token":"', '"}')
                    || getFrom(html, '"lsd":{"token":"',      '"');

          if (!dtsg) {
            if (attempt < 2) {
              await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
              return tryRefresh(attempt + 1);
            }
            throw new Error("[ AYMAN ] لم يُعثر على fb_dtsg بعد 3 محاولات");
          }

          // ✅ تحديث ctx بكل القيم الجديدة
          ctx.fb_dtsg = dtsg;
          if (jaz) ctx.jazoest = jaz;
          if (lsd) ctx.lsd     = lsd;

          callback(null, {
            data: { fb_dtsg: dtsg, jazoest: jaz, lsd },
            message: "تم تجديد fb_dtsg ✅"
          });
        } catch (err) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            return tryRefresh(attempt + 1);
          }
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
