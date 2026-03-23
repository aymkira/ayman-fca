// ============================================================
//  AYMAN-FCA v2.0 — Get Current User ID
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

module.exports = function(defaultFuncs, api, ctx) {
  return function getCurrentUserID() {
    return ctx.userID;
  };
};
