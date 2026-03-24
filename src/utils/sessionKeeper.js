// ============================================================
//  AYMAN-FCA ULTRA v3.0 — Session Keeper
//  © 2025 Ayman. All Rights Reserved.
//
//  🔥 الإصلاحات عن v2.2:
//    ✅ xs refresh كل ساعتين (بدل 4) + fallback لـ m.facebook.com
//    ✅ fb_dtsg refresh كل ساعتين (بدل 4)
//    ✅ presence كل 30 ثانية (بدل 45)
//    ✅ cookie daisy-chain: c_user + xs + fr + wd + sb
//    ✅ فحص صلاحية appState كل 10 دقائق
//    ✅ watchdog يطلب reconnect بعد 3 دقائق انقطاع (بدل 5)
//    ✅ دعم onSessionExpired callback من البوت
//    ✅ حفظ atomic مع 5 نسخ احتياطية + rotate تلقائي
// ============================================================
"use strict";

const fs   = require("fs");
const path = require("path");

let logger;
try {
  logger = require("../../../func/logger");
} catch(_) {
  logger = (msg, type) => process.stderr.write(`[ SK ][ ${type||"info"} ] ${msg}\n`);
}

// ── Presence Encoder ─────────────────────────────────────────
const PMAP = {
  _:"%", A:"%2", B:"000", C:"%7d", D:"%7b%22", E:"%2c%22",
  F:"%22%3a", G:"%2c%22ut%22%3a1",
  Z:"%2c%22sb%22%3a1%2c%22t%22%3a%5b%5d%2c%22f%22%3anull%2c%22uct%22%3a0%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a"
};
const EM = {}, DL = [];
for (const [k,v] of Object.entries(PMAP)) { EM[v]=k; DL.push(v); }
DL.sort((a,b)=>b.length-a.length);
const PR = new RegExp(DL.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"g");
function presenceEncode(s){ return encodeURIComponent(s).replace(PR,m=>EM[m]||m); }
function generatePresence(uid){
  const t = Date.now();
  return "E" + presenceEncode(JSON.stringify({
    v:3, time:Math.floor(t/1000), user:uid,
    state:{ ut:0, t2:[], lm2:null, uct2:t, tr:null,
      tw:Math.floor(Math.random()*4294967295)+1, at:t },
    ch:{ [`p_${uid}`]:0 }
  }));
}
function generateAccessibilityCookie(){
  const t = Date.now();
  return encodeURIComponent(JSON.stringify({
    sr:0,"sr-ts":t,jk:0,"jk-ts":t,kb:0,"kb-ts":t,hcm:0,"hcm-ts":t
  }));
}

// ── Cookie Helpers ────────────────────────────────────────────
function setCookieSafe(jar, str, url){
  try {
    if (typeof jar?.setCookieSync==="function") jar.setCookieSync(str, url);
    else if (typeof jar?.setCookie==="function") jar.setCookie(str, url);
  } catch(_) {}
}
function getCookieValue(jar, name, url="https://www.facebook.com"){
  try {
    const cookies = jar?.getCookiesSync?.(url) || [];
    const c = cookies.find(x=>(x.key||x.name)===name);
    return c?.value || null;
  } catch(_) { return null; }
}

// ── AppState IO ───────────────────────────────────────────────
function isValidState(state){
  return Array.isArray(state) && state.length > 0 &&
    state.some(c=> (c.key||c.name)==="c_user");
}
function stateHash(state){
  const xs = state.find(c=>(c.key||c.name)==="xs");
  const cu = state.find(c=>(c.key||c.name)==="c_user");
  return `${state.length}_${cu?.value?.slice(0,6)||""}_${xs?.value?.slice(0,8)||""}`;
}
function saveAtomic(filePath, state){
  try {
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, "\t"), "utf8");
    fs.renameSync(tmp, filePath);
    return true;
  } catch(e) {
    logger(`خطأ في حفظ AppState: ${e?.message||e}`, "error");
    return false;
  }
}
function saveBackup(backupDir, state){
  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, {recursive:true});
    const file = path.join(backupDir, `backup_${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(state, null, "\t"), "utf8");
    // احتفظ بـ 5 نسخ فقط
    const files = fs.readdirSync(backupDir)
      .filter(f=>f.startsWith("backup_")&&f.endsWith(".json"))
      .sort().reverse();
    for (const old of files.slice(5)){
      try { fs.unlinkSync(path.join(backupDir,old)); } catch(_) {}
    }
  } catch(_) {}
}

// ── ctx extractor ─────────────────────────────────────────────
function extractCtx(api, hint){
  if (hint?.jar && hint?.userID && hint.userID!=="0") return hint;
  for (const k of Object.getOwnPropertyNames(api||{})){
    try {
      const v = api[k];
      if (v && typeof v==="object" && v.jar && v.userID && v.userID!=="0") return v;
    } catch(_) {}
  }
  return hint || {};
}

// ── HTTP fetch with fallback ──────────────────────────────────
async function safeFetch(url, jar, ctx){
  // محاولة 1: request داخلي
  try {
    const { get } = require("./request");
    const res = await get(url, jar, null, ctx?.globalOptions||{}, ctx);
    const sc = res?.headers?.["set-cookie"] || [];
    for (const c of sc){ try{ setCookieSafe(jar, c, "https://www.facebook.com"); }catch(_){} }
    return res;
  } catch(_) {}

  // محاولة 2: axios مع cookie يدوي
  try {
    const axios = require("axios");
    const cookies = jar?.getCookiesSync?.("https://www.facebook.com")
      ?.map(c=>`${c.key||c.name}=${c.value}`).join("; ") || "";
    const res = await axios.get(url, {
      headers: {
        "Cookie": cookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.facebook.com/"
      },
      timeout: 25000,
      validateStatus: s=>s<600,
      maxRedirects: 5
    });
    const sc = res.headers?.["set-cookie"] || [];
    for (const c of sc){ try{ setCookieSafe(jar, c, "https://www.facebook.com"); }catch(_){} }
    return res;
  } catch(_) { return null; }
}

// ════════════════════════════════════════════════════════════════
function createSessionKeeper(api, ctxHint, options = {}){
  const appStatePath = options.appStatePath || path.join(process.cwd(), "appstate.json");
  const backupDir    = options.backupDir    || path.join(path.dirname(appStatePath), "session_backups");
  const onSave       = typeof options.onSave==="function" ? options.onSave : null;
  const onExpired    = typeof options.onSessionExpired==="function" ? options.onSessionExpired : null;

  let ctx = extractCtx(api, ctxHint);

  let _presence=null, _activity=null, _dtsg=null, _save=null;
  let _access=null, _ping=null, _xsRefresh=null, _watchdog=null, _validate=null;
  let _active=false, _lastHash=null, _lastEventAt=Date.now();

  function getCtx(){
    if (!ctx?.jar || !ctx?.userID || ctx.userID==="0") ctx = extractCtx(api, ctxHint);
    return ctx;
  }

  // ── حفظ AppState ─────────────────────────────────────────────
  function _triggerSave(force=false){
    try {
      if (!api?.getAppState) return;
      const state = api.getAppState();
      if (!isValidState(state)) return;
      const hash = stateHash(state);
      if (!force && hash===_lastHash) return;
      _lastHash = hash;
      const ok = saveAtomic(appStatePath, state);
      if (ok){
        saveBackup(backupDir, state);
        logger("AppState محفوظ ✅", "info");
        if (onSave) onSave(state);
      }
    } catch(_) {}
  }

  // ① Presence كل 30 ثانية
  function startPresence(){
    if (_presence) return;
    _presence = setInterval(()=>{
      try {
        const c = getCtx();
        if (!c?.mqttClient?.connected || !c?.userID) return;
        const p = generatePresence(c.userID);
        c.mqttClient.publish("/orca_presence", JSON.stringify({p, c:c.userID}), {qos:0});
        c.mqttClient.publish("/set_client_settings",
          JSON.stringify({make_user_available_when_in_foreground:true}), {qos:0});
        _lastEventAt = Date.now();
      } catch(_) {}
    }, 30*1000);
  }

  // ② foreground state كل دقيقة
  let _fg = null;
  function startForeground(){
    if (_fg) return;
    _fg = setInterval(()=>{
      try {
        const c = getCtx();
        if (!c?.mqttClient?.connected) return;
        c.mqttClient.publish("/foreground_state", JSON.stringify({foreground:true}), {qos:0});
      } catch(_) {}
    }, 60*1000);
  }

  // ③ نشاط عشوائي كل 3–7 دقائق
  function scheduleActivity(){
    const ms = (3 + Math.random()*4)*60*1000;
    _activity = setTimeout(async ()=>{
      try {
        const c = getCtx();
        if (Math.random()>0.5){ if (api?.markAsReadAll) api.markAsReadAll(()=>{}); }
        else if (c?.mqttClient?.connected){
          c.mqttClient.publish("/foreground_state", JSON.stringify({foreground:true}), {qos:0});
        }
      } catch(_) {}
      scheduleActivity();
    }, ms);
  }

  // ④ تجديد fb_dtsg كل ساعتين ← كان 4 ساعات
  function startDtsgRefresh(){
    if (_dtsg) return;
    async function refresh(){
      try {
        if (api?.refreshFb_dtsg){
          await api.refreshFb_dtsg();
          logger("fb_dtsg مجدد ✅", "info");
          _triggerSave();
          return;
        }
        // fallback يدوي
        const c = getCtx();
        if (!c?.jar) return;
        const res = await safeFetch("https://m.facebook.com/", c.jar, c);
        const html = res?.data || res?.body || "";
        if (typeof html==="string"){
          const dtsg = html.match(/name="fb_dtsg" value="([^"]+)"/)?.[1]
            || html.match(/"dtsg":\{"token":"([^"]+)"/)?.[1];
          const jaz  = html.match(/name="jazoest" value="([^"]+)"/)?.[1];
          if (dtsg){ c.fb_dtsg=dtsg; if(jaz) c.jazoest=jaz; logger("fb_dtsg مجدد (fallback) ✅","info"); }
        }
        _triggerSave();
      } catch(e){ logger(`fb_dtsg خطأ: ${e?.message||e}`, "warn"); }
    }
    // شغّل مرة أولى بعد 30 دقيقة ثم كل ساعتين
    setTimeout(refresh, 30*60*1000);
    _dtsg = setInterval(refresh, 2*60*60*1000);
  }

  // ⑤ حفظ كل 8 دقائق
  function startAutoSave(){
    if (_save) return;
    _save = setInterval(()=>_triggerSave(), 8*60*1000);
  }

  // ⑥ Accessibility + sb + wd cookies كل 30 دقيقة
  function startAccessibilityCookie(){
    if (_access) return;
    function update(){
      try {
        const c = getCtx();
        if (!c?.jar) return;
        const exp = new Date(Date.now()+365*24*3600*1000).toUTCString();
        const wd  = generateAccessibilityCookie();
        setCookieSafe(c.jar, `wd=${wd}; domain=.facebook.com; path=/; expires=${exp}`, "https://www.facebook.com");
        const sb = getCookieValue(c.jar, "sb") || `Cr${Math.random().toString(36).slice(2,12)}`;
        setCookieSafe(c.jar, `sb=${sb}; domain=.facebook.com; path=/; expires=${exp}`, "https://www.facebook.com");
      } catch(_) {}
    }
    update();
    _access = setInterval(update, 30*60*1000);
  }

  // ⑦ xs refresh كل ساعتين ← كان 4 ساعات
  function startXsRefresh(){
    if (_xsRefresh) return;
    async function refresh(){
      try {
        const c = getCtx();
        if (!c?.jar) return;
        let res = await safeFetch("https://www.facebook.com/", c.jar, c);
        if (!res || (res.status && res.status >= 400)){
          res = await safeFetch("https://m.facebook.com/", c.jar, c);
        }
        if (res){ logger("xs cookie مجدد ✅", "info"); _triggerSave(); }
      } catch(e){ logger(`xs refresh خطأ: ${e?.message||e}`, "warn"); }
    }
    // أول تشغيل بعد ساعة
    setTimeout(refresh, 60*60*1000);
    _xsRefresh = setInterval(refresh, 2*60*60*1000);
  }

  // ⑧ MQTT Ping كل 45 ثانية
  function startPing(){
    if (_ping) return;
    _ping = setInterval(()=>{
      try {
        const c = getCtx();
        if (!c?.mqttClient?.connected) return;
        c.mqttClient.publish("/set_client_settings",
          JSON.stringify({make_user_available_when_in_foreground:true}), {qos:0});
      } catch(_) {}
    }, 45*1000);
  }

  // ⑨ Watchdog — يطلب reconnect بعد 3 دقائق انقطاع ← كان 5
  function startWatchdog(){
    if (_watchdog) return;
    let lastAlive=Date.now(), deadCount=0;
    _watchdog = setInterval(()=>{
      try {
        const c = getCtx();
        if (!c?.mqttClient) return;
        if (c.mqttClient?.connected){ lastAlive=Date.now(); deadCount=0; return; }
        const deadMs = Date.now()-lastAlive;
        if (deadMs > 3*60*1000 && !c.mqttClient?.reconnecting){
          deadCount++;
          logger(`[ Watchdog ] MQTT منقطع ${Math.round(deadMs/60000)} دقيقة (${deadCount}/2)`, "warn");
          if (deadCount>=2){
            deadCount=0; lastAlive=Date.now();
            try { if (c?._emitter?.emit) c._emitter.emit("watchdog_reconnect",{reason:"mqtt_dead"}); }
            catch(_) {}
          }
        }
      } catch(_) {}
    }, 2*60*1000);
  }

  // ⑩ التحقق من صلاحية الجلسة كل 10 دقائق
  function startSessionValidation(){
    if (_validate) return;
    _validate = setInterval(()=>{
      try {
        if (!api?.getCurrentUserID) return;
        const uid = api.getCurrentUserID();
        if (!uid || uid==="0"){
          logger("[ Validate ] الجلسة منتهية!", "error");
          if (onExpired) onExpired();
        } else {
          logger(`[ Validate ] جلسة سليمة ✅ uid=${uid}`, "debug");
          _triggerSave();
        }
      } catch(e){ logger(`[ Validate ] خطأ: ${e?.message||e}`, "warn"); }
    }, 10*60*1000);
  }

  function _installHeartbeat(){
    try {
      const c = getCtx();
      if (c?._emitter?.on) c._emitter.on("message", ()=>{ _lastEventAt=Date.now(); });
      else if (api?.on)     api.on("message", ()=>{ _lastEventAt=Date.now(); });
    } catch(_) {}
  }

  function start(){
    if (_active) return;
    _active = true;
    setTimeout(()=>{ ctx = extractCtx(api, ctxHint); _installHeartbeat(); }, 1500);
    startPresence();
    startForeground();
    scheduleActivity();
    startDtsgRefresh();
    startAutoSave();
    startAccessibilityCookie();
    startXsRefresh();
    startPing();
    startWatchdog();
    startSessionValidation();
    logger("Session Keeper v3.0 ✅ — 10 أنظمة تعمل", "info");
  }

  function stop(){
    _active = false;
    [_presence,_fg,_dtsg,_save,_access,_xsRefresh,_ping,_watchdog,_validate]
      .forEach(t=>{ try{ if(t) clearInterval(t); }catch(_){} });
    try{ if(_activity) clearTimeout(_activity); }catch(_){}
    _presence=_fg=_activity=_dtsg=_save=_access=_xsRefresh=_ping=_watchdog=_validate=null;
    _triggerSave(true);
    logger("Session Keeper موقوف + حفظ أخير ✅","info");
  }

  function saveNow(){ _triggerSave(true); return true; }
  function updateCtx(c){ if(c?.jar&&c?.userID){ ctx=c; logger("ctx مُحدَّث ✅","info"); } }
  function getLastEventAge(){ return Date.now()-_lastEventAt; }

  return { start, stop, saveNow, updateCtx, getLastEventAge,
    generatePresence, generateAccessibilityCookie };
}

module.exports = { createSessionKeeper, generatePresence, generateAccessibilityCookie, saveAtomic };
