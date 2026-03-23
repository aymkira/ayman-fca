// ============================================================
//  AYMAN-FCA v2.0 — Utils Client
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { saveCookies, getAppState }    = require("./cookies");
const { parseAndCheckLogin }          = require("./loginParser");

module.exports = { saveCookies, getAppState, parseAndCheckLogin };
