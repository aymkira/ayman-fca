// ============================================================
//  AYMAN-FCA v2.0 — GetSeqID + Local Session Recovery
//  © 2025 Ayman. All Rights Reserved.
//
//  🔑 استعادة الجلسة محلياً 100% بدون أي سيرفر خارجي
//  مراحل الاستعادة عند انتهاء الجلسة:
//  1. تجديد fb_dtsg من Facebook مباشرة
//  2. تجديد الجلسة من www.facebook.com
//  3. تجديد من m.facebook.com (النسخة المحمولة)
//  4. تجديد من home.php
//  5. إشعار البوت بالفشل + حفظ AppState
// ============================================================
"use strict";

const { getType }               = require("../../../utils/format");
const { parseAndCheckLogin, saveCookies } = require("../../../utils/client");
const { get }                   = require("../../../utils/request");
const { saveAppStateAtomic }    = require("../../../utils/sessionKeeper");
const path                      = require("path");
const fs                        = require("fs");

const MAX_RETRIES  = 4;
const RETRY_DELAY  = 2500;

const isValidUID = uid =>
  uid && uid !== "0" && /^\d+$/.test(uid) && parseInt(uid, 10) > 0;

const extractUID = html => {
  const s = typeof html === "string" ? html : String(html || "");
  return s.match(/"USER_ID"\s*:\s*"(\d+)"/)?.[1] ||
         s.match(/\["CurrentUserInitialData",\[\],\{".*?"USER_ID":"(\d+)".*?\},\d+\]/)?.[1];
};

// ✅ تجديد fb_dtsg من Facebook مباشرة
async function refreshFbDtsgLocal(ctx, logger) {
  try {
    const { getFrom } = require("../../../utils/constants");
    const res   = await get("https://www.facebook.com/", ctx.jar, null, ctx.globalOptions, ctx);
    const html  = res?.data || "";
    const dtsg  = getFrom(html, '["DTSGInitData",[],{"token":"', '","');
    const jaz   = getFrom(html, "jazoest=", '",');
    if (dtsg) {
      ctx.fb_dtsg = dtsg;
      if (jaz) ctx.jazoest = jaz;
      logger("[ AYMAN ] fb_dtsg مجدد ✅", "info");
      return true;
    }
  } catch (_) {}
  return false;
}

// ✅ تجديد الجلسة محلياً من عدة نقاط
async function refreshSessionLocally(ctx, logger) {
  const urls = [
    "https://www.facebook.com/",
    "https://m.facebook.com/",
    "https://www.facebook.com/home.php",
    "https://m.facebook.com/home.php"
  ];

  for (const url of urls) {
    try {
      const res  = await get(url, ctx.jar, null, ctx.globalOptions, ctx).then(saveCookies(ctx.jar));
      const html = res?.data || "";
      const uid  = extractUID(html);
      if (isValidUID(uid)) {
        ctx.loggedIn = true;
        ctx.userID   = uid;
        logger(`[ AYMAN ] جلسة مستعادة ✅ من ${url} | UID: ${uid}`, "info");
        return true;
      }
    } catch (_) {}
  }

  logger("[ AYMAN ] فشل استعادة الجلسة من كل المصادر", "warn");
  return false;
}

// ✅ حفظ AppState بعد نجاح الاستعادة
function saveAfterRecovery(ctx, logger) {
  try {
    const { getAppState } = require("../../../utils/cookies");
    const p     = path.join(process.cwd(), "appstate.json");
    const state = getAppState(ctx.jar);
    if (state && state.length > 0) {
      saveAppStateAtomic(p, state);
      logger("[ AYMAN ] AppState محفوظ بعد الاستعادة ✅", "info");
    }
  } catch (_) {}
}

module.exports = function createGetSeqID(deps) {
  const { listenMqtt, logger, emitAuth } = deps;

  return function getSeqID(defaultFuncs, api, ctx, globalCallback, form, retryCount = 0) {
    ctx.t_mqttCalled = false;

    return defaultFuncs
      .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
      .then(parseAndCheckLogin(ctx, defaultFuncs))
      .then(async resData => {
        if (getType(resData) !== "Array") {
          const errMsg = resData?.error || resData?.message || "";
          if (/Not logged in|login|blocked|401|403|checkpoint/i.test(errMsg)) {
            throw { error: "Not logged in", res: resData };
          }
          throw { error: "Not logged in", res: resData };
        }
        if (!Array.isArray(resData) || !resData.length) return;
        const last = resData[resData.length - 1];
        if (last?.successful_results === 0) return;

        const syncSeqId = resData[0]?.o0?.data?.viewer?.message_threads?.sync_sequence_id;
        if (syncSeqId) {
          ctx.lastSeqId        = syncSeqId;
          ctx._reconnectAttempts = 0;
          logger("[ AYMAN ] SeqID ✅ — بدء الاستماع", "info");
          listenMqtt(defaultFuncs, api, ctx, globalCallback);
        } else {
          throw { error: "getSeqId: no sync_sequence_id found." };
        }
      })
      .catch(async err => {
        const msg = (err?.error) || (err?.message) || String(err || "");
        const isAuth = /Not logged in|no sync_sequence_id|blocked the login|401|403/i.test(msg);

        if (isAuth) {
          // ── المرحلة 1: retry مع تجديد fb_dtsg ──────────────
          if (retryCount < MAX_RETRIES) {
            const d = RETRY_DELAY * (retryCount + 1);
            logger(`[ AYMAN ] SeqID retry ${retryCount + 1}/${MAX_RETRIES} بعد ${d}ms`, "warn");
            await new Promise(r => setTimeout(r, d));

            if (retryCount === 0) await refreshFbDtsgLocal(ctx, logger);
            if (retryCount === 1) {
              const ok = await refreshSessionLocally(ctx, logger);
              if (ok) saveAfterRecovery(ctx, logger);
            }
            if (retryCount >= 2) {
              await refreshFbDtsgLocal(ctx, logger);
              const ok = await refreshSessionLocally(ctx, logger);
              if (ok) saveAfterRecovery(ctx, logger);
            }

            return getSeqID(defaultFuncs, api, ctx, globalCallback, form, retryCount + 1);
          }

          // ── المرحلة 2: آخر محاولة شاملة ────────────────────
          logger("[ AYMAN ] كل المحاولات فشلت — محاولة أخيرة...", "warn");
          const ok = await refreshSessionLocally(ctx, logger);
          if (ok) {
            await refreshFbDtsgLocal(ctx, logger);
            saveAfterRecovery(ctx, logger);
            await new Promise(r => setTimeout(r, 3000));
            return getSeqID(defaultFuncs, api, ctx, globalCallback, form, 0);
          }

          // ── فشل كل شيء ───────────────────────────────────────
          // احفظ AppState قبل الإيقاف
          saveAfterRecovery(ctx, logger);

          if (/blocked/i.test(msg)) return emitAuth(ctx, api, globalCallback, "login_blocked", msg);
          return emitAuth(ctx, api, globalCallback, "not_logged_in", msg);
        }

        logger(`[ AYMAN ] getSeqID خطأ: ${msg}`, "error");
        return emitAuth(ctx, api, globalCallback, "auth_error", msg);
      });
  };
};
