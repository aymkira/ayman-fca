// ============================================================
//  AYMAN-FCA ULTRA CORE — Validator
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

function isValidAppState(state) {
  if (!Array.isArray(state) || state.length === 0) return false;
  const keys = state.map(c => c.key || c.name).filter(Boolean);
  // appstate صالح يحتوي على c_user و xs على الأقل
  return keys.includes("c_user") || keys.includes("i_user");
}

function isValidUID(uid) {
  return uid && uid !== "0" && /^\d+$/.test(String(uid)) && parseInt(uid, 10) > 0;
}

function extractUID(state) {
  if (!Array.isArray(state)) return null;
  const cu = state.find(c => (c.key || c.name) === "c_user");
  const iu = state.find(c => (c.key || c.name) === "i_user");
  return (iu || cu)?.value || null;
}

function appStateHash(state) {
  if (!Array.isArray(state)) return "";
  const xs = state.find(c => (c.key || c.name) === "xs");
  const cu = state.find(c => (c.key || c.name) === "c_user");
  return `${state.length}_${cu?.value?.slice(0,6) || ""}_${xs?.value?.slice(0,8) || ""}`;
}

module.exports = { isValidAppState, isValidUID, extractUID, appStateHash };
