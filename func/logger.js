// ============================================================
//  AYMAN-FCA v2.0 — Logger
//  © 2025 Ayman. All Rights Reserved.
//  جميع الحقوق محفوظة لأيمن
// ============================================================
"use strict";

const chalk    = require("chalk");
const gradient = require("gradient-string");

const THEMES = [
  "blue","dream2","dream","fiery","rainbow","pastel",
  "cristal","red","aqua","pink","retro","sunlight",
  "teen","summer","flower","ghost","hacker"
];

function buildGradient(name) {
  const t = String(name || "").toLowerCase();
  if (t === "blue")     return gradient([{color:"#1affa3",pos:.2},{color:"cyan",pos:.4},{color:"pink",pos:.6},{color:"cyan",pos:.8},{color:"#1affa3",pos:1}]);
  if (t === "dream2")   return gradient("blue","pink");
  if (t === "dream")    return gradient([{color:"blue",pos:.2},{color:"pink",pos:.3},{color:"gold",pos:.6},{color:"pink",pos:.8},{color:"blue",pos:1}]);
  if (t === "fiery")    return gradient("#fc2803","#fc6f03","#fcba03");
  if (t === "rainbow")  return gradient.rainbow;
  if (t === "pastel")   return gradient.pastel;
  if (t === "cristal")  return gradient.cristal;
  if (t === "red")      return gradient("red","orange");
  if (t === "aqua")     return gradient("#0030ff","#4e6cf2");
  if (t === "pink")     return gradient("#d94fff","purple");
  if (t === "retro")    return gradient.retro;
  if (t === "sunlight") return gradient("orange","#ffff00","#ffe600");
  if (t === "teen")     return gradient.teen;
  if (t === "summer")   return gradient.summer;
  if (t === "flower")   return gradient("blue","purple","yellow","#81ff6e");
  if (t === "ghost")    return gradient.mind;
  if (t === "hacker")   return gradient("#47a127","#0eed19","#27f231");
  return gradient("#243aff","#4687f0","#5800d4");
}

const themeName = THEMES[Math.floor(Math.random() * THEMES.length)];
const co        = buildGradient(themeName);

// ✅ تسجيل الأوقات لكل رسالة لتسهيل التشخيص
function timestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

module.exports = function logger(text, type) {
  const s   = String(type || "info").toLowerCase();
  const ts  = timestamp();

  if (s === "warn") {
    process.stderr.write(co(`\r[ AYMAN-WARN ][ ${ts} ] > ${text}`) + "\n");
    return;
  }
  if (s === "error") {
    process.stderr.write(
      chalk.bold.hex("#ff0000")(`\r[ AYMAN-ERROR ][ ${ts} ]`) + ` > ${text}\n`
    );
    return;
  }
  if (s === "info") {
    process.stderr.write(chalk.bold(co(`\r[ AYMAN-FCA ][ ${ts} ] > ${text}`)) + "\n");
    return;
  }
  process.stderr.write(chalk.bold(co(`\r[ ${s.toUpperCase()} ][ ${ts} ] > ${text}`)) + "\n");
};
