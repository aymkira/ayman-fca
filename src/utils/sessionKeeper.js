// ============================================================
//  AYMAN-FCA v2.2 — Session Keeper (FIXED)
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const fs   = require("fs");
const path = require("path");

let logger;
try {
  logger = require("../../../func/logger");
} catch(_) {
  logger = (msg, type) => process.stderr.write(`[ AYMAN-SK ][ ${type || "info"} ] ${msg}\n`);
}

// ── Presence Encoder ──────────────────────────────────────────
const PRESENCE_MAP = {
  _:"%", A:"%2", B:"000", C:"%7d", D:"%7b%22", E:"%2c%22",
  F:"%22%3a", G:"%2c%22ut%22%3a1", H:"%2c%22bls%22%3a",
  I:"%2c%22n%22%3a%22%", J:"%22%3a%7b%22i%22%3a0%7d",
  K:"%2c%22pt%22%3a0%2c%22vis%22%3a", L:"%2c%22ch%22%3a%7b%22h%22%3a%22",
  M:"%7b%22v%22%3a2%2c%22time%22%3a1", N:".channel%22%2c%22sub%22%3a%5b",
  O:"%2c%22sb%22%3a1%2c%22t%22%3a%5b", P:"%2c%22ud%22%3a100%2c%22lc%22%3a0",
  Q:"%5d%2c%22f%22%3anull%2c%22uct%22%3a", R:".channel%22%2c%22sub%22%3a%5b1%5d",
  Z:"%2c%22sb%22%3a1%2c%22t%22%3a%5b%5d%2c%22f%22%3anull%2c%22uct%22%3a0%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a"
};
const encodeMap = {}, decodeList = [];
for (const [k,v] of Object.entries(PRESENCE_MAP)) { encodeMap[v]=k; decodeList.push(v); }
decodeList.sort((a,b)=>b.length-a.length);
const presenceRegex = new RegExp(decodeList.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"g");
function presenceEncode(str){ return encodeURIComponent(str).replace(presenceRegex,m=>encodeMap[m]||m); }

function generatePresence(userID) {
  const time = Date.now();
  return "E" + presenceEncode(JSON.stringify({
    v:3, time:Math.floor(time/1000), user:userID,
    state:{ ut:0, t2:[], lm2:null, uct2:time, tr:null,
      tw:Math.floor(Math.random()*4294967295)+1, at:time },
    ch:{ [`p_${userID}`]:0 }
  }));
}

function generateAccessibilityCookie() {
  const time = Date.now();
  return encodeURIComponent(JSON.stringify({
    sr:0,"sr-ts":time,jk:0,"jk-ts":time,kb:0,"kb-ts":time,hcm:0,"hcm-ts":time
  }));
}

function saveAppStateAtomic(statePath, state) {
  try {
    const tmp = statePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, "\t"), "utf8");
    fs.renameSync(tmp, statePath);
    return true;
  } catch(e) {
    logger(`خطأ في حفظ AppState: ${e?.message||e}`, "error");
    return false;
  }
}

function setCookieSafe(jar, cookieStr, url) {
  try {
    if (typeof jar?.setCookieSync==="function") jar.setCookieSync(cookieStr, url);
    else if (typeof jar?.setCookie==="function") jar.setCookie(cookieStr, url);
  } catch(_) {}
}

// ✅ استخراج ctx الحقيقي من api
function extractCtx(api, hint) {
  if (hint && hint.jar && hint.userID && hint.userID !== "0") return hint;
  for (const key of Object.getOwnPropertyNames(api || {})) {
    try {
      const v = api[key];
      if (v && typeof v==="object" && v.jar && v.userID && v.userID!=="0") return v;
    } catch(_) {}
  }
  return hint || {};
}

// ✅ xs refresh آمن — المسار الصحيح
async function safeFetch(url, jar, ctx) {
  // ✅ الإصلاح: require("./request") وليس require("../request")
  try {
    const { get } = require("./request");
    const res = await get(url, jar, null, ctx?.globalOptions||{}, ctx);
    const sc  = res?.headers?.["set-cookie"] || [];
    for (const c of sc) { try { setCookieSafe(jar, c, "https://www.facebook.com"); } catch(_) {} }
    return res;
  } catch(_) {
    // fallback: axios مباشرة
    try {
      const axios   = require("axios");
      const cookies = jar?.getCookiesSync?.(url)?.map(c=>`${c.key}=${c.value}`).join("; ")||"";
      const res = await axios.get(url, {
        headers:{ "Cookie":cookies, "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36" },
        timeout:20000, validateStatus:s=>s<600
      });
      const sc = res.headers?.["set-cookie"]||[];
      for (const c of sc) { try { setCookieSafe(jar, c, "https://www.facebook.com"); } catch(_) {} }
      return res;
    } catch(_) { return null; }
  }
}

// ════════════════════════════════════════════════════════════════
function createSessionKeeper(api, ctxHint, options = {}) {
  const appStatePath = options.appStatePath || path.join(process.cwd(), "appstate.json");
  const onSave       = typeof options.onSave==="function" ? options.onSave : null;

  let ctx = extractCtx(api, ctxHint);

  let _presence=null, _activity=null, _dtsg=null, _save=null;
  let _access=null, _ping=null, _xsRefresh=null, _watchdog=null;
  let _active=false, _lastHash=null;

  function getCtx() {
    if (!ctx?.jar || !ctx?.userID || ctx.userID==="0") ctx = extractCtx(api, ctxHint);
    return ctx;
  }

  function _triggerSave(force=false) {
    try {
      if (!api?.getAppState) return;
      const state = api.getAppState();
      if (!state || state.length===0) return;
      const xs  = state.find(c=>(c.key||c.name)==="xs");
      const cu  = state.find(c=>(c.key||c.name)==="c_user");
      const hash= `${state.length}_${cu?.value?.slice(0,6)||""}_${xs?.value?.slice(0,8)||""}`;
      if (!force && hash===_lastHash) return;
      _lastHash = hash;
      const ok  = saveAppStateAtomic(appStatePath, state);
      if (ok) { logger("AppState محفوظ ✅","info"); if (onSave) onSave(state); }
    } catch(_) {}
  }

  // ① Presence كل 45 ثانية
  function startPresence() {
    if (_presence) return;
    _presence = setInterval(()=>{
      try {
        const c = getCtx();
        if (!c?.mqttClient?.connected || !c?.userID) return;
        const p = generatePresence(c.userID);
        c.mqttClient.publish("/orca_presence", JSON.stringify({p, c:c.userID}), {qos:0});
      } catch(_) {}
    }, 45*1000);
  }

  // ② نشاط عشوائي كل 3-7 دقائق
  function scheduleActivity() {
    const ms = (3 + Math.random()*4)*60*1000;
    _activity = setTimeout(async ()=>{
      try {
        const c = getCtx();
        if (Math.random()>0.5) { if (api?.markAsReadAll) api.markAsReadAll(()=>{}); }
        else if (c?.mqttClient?.connected)
          c.mqttClient.publish("/foreground_state", JSON.stringify({foreground:true}), {qos:0});
      } catch(_) {}
      scheduleActivity();
    }, ms);
  }

  // ③ تجديد fb_dtsg كل 4 ساعات
  function startDtsgRefresh() {
    if (_dtsg) return;
    _dtsg = setInterval(async ()=>{
      try {
        if (api?.refreshFb_dtsg) { await api.refreshFb_dtsg(); logger("fb_dtsg مجدد ✅","info"); _triggerSave(); }
      } catch(_) {}
    }, 4*60*60*1000);
  }

  // ④ حفظ كل 8 دقائق
  function startAutoSave() {
    if (_save) return;
    _save = setInterval(()=> _triggerSave(), 8*60*1000);
  }

  // ⑤ Accessibility cookie كل 30 دقيقة
  function startAccessibilityCookie() {
    if (_access) return;
    function update() {
      try {
        const c = getCtx();
        if (!c?.jar) return;
        const val = generateAccessibilityCookie();
        const exp = new Date(Date.now()+365*24*3600*1000).toUTCString();
        setCookieSafe(c.jar, `wd=${val}; domain=.facebook.com; path=/; expires=${exp}`, "https://www.facebook.com");
      } catch(_) {}
    }
    update();
    _access = setInterval(update, 30*60*1000);
  }

  // ⑥ ✅ تجديد xs كل 4 ساعات — إصلاح المسار
  function startXsRefresh() {
    if (_xsRefresh) return;
    _xsRefresh = setInterval(async ()=>{
      try {
        const c = getCtx();
        if (!c?.jar) return;
        const res = await safeFetch("https://www.facebook.com/", c.jar, c);
        if (res) { logger("xs cookie مجدد ✅","info"); _triggerSave(); }
      } catch(_) {}
    }, 4*60*60*1000);
  }

  // ⑦ Ping MQTT كل ساعة
  function startPing() {
    if (_ping) return;
    _ping = setInterval(()=>{
      try {
        const c = getCtx();
        if (!c?.mqttClient?.connected) return;
        c.mqttClient.publish("/set_client_settings",
          JSON.stringify({make_user_available_when_in_foreground:true}), {qos:0});
      } catch(_) {}
    }, 60*60*1000);
  }

  // ⑧ Watchdog — يراقب MQTT كل دقيقتين
  function startWatchdog() {
    if (_watchdog) return;
    let lastAlive = Date.now(), deadCount = 0;
    _watchdog = setInterval(()=>{
      try {
        const c = getCtx();
        if (!c?.mqttClient) return;
        if (c.mqttClient?.connected) { lastAlive=Date.now(); deadCount=0; return; }
        const deadMs = Date.now()-lastAlive;
        if (deadMs > 5*60*1000 && !c.mqttClient?.reconnecting) {
          deadCount++;
          logger(`[ Watchdog ] MQTT منقطع ${Math.round(deadMs/60000)} دقيقة (${deadCount}/3)`, "warn");
          if (deadCount>=3) {
            deadCount=0; lastAlive=Date.now();
            try { if (c?._emitter?.emit) c._emitter.emit("watchdog_reconnect",{reason:"mqtt_dead"}); }
            catch(_) {}
          }
        }
      } catch(_) {}
    }, 2*60*1000);
  }

  function start() {
    if (_active) return;
    _active = true;
    setTimeout(()=>{ ctx = extractCtx(api, ctxHint); }, 1000);
    startPresence();
    scheduleActivity();
    startDtsgRefresh();
    startAutoSave();
    startAccessibilityCookie();
    startXsRefresh();
    startPing();
    startWatchdog();
    logger("Session Keeper v2.2 ✅ — 8 أنظمة تعمل", "info");
  }

  function stop() {
    _active = false;
    [_presence,_dtsg,_save,_access,_xsRefresh,_ping,_watchdog].forEach(t=>{ try{if(t)clearInterval(t);}catch(_){} });
    try{if(_activity)clearTimeout(_activity);}catch(_){}
    _presence=_activity=_dtsg=_save=_access=_xsRefresh=_ping=_watchdog=null;
    logger("Session Keeper موقوف","info");
  }

  function saveNow() { _triggerSave(true); return true; }
  function updateCtx(c) { if (c?.jar&&c?.userID) { ctx=c; logger("ctx مُحدَّث ✅","info"); } }

  return { start, stop, saveNow, updateCtx, generatePresence, generateAccessibilityCookie };
}

module.exports = { createSessionKeeper, generatePresence, generateAccessibilityCookie, saveAppStateAtomic };
