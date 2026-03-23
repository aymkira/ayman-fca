// ============================================================
//  AYMAN-FCA v2.0 — Add External Module
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function addExternalModule(moduleObj) {
    if (getType(moduleObj) !== "Object")
      throw new Error(`moduleObj يجب أن يكون Object وليس ${getType(moduleObj)}`);
    for (const name in moduleObj) {
      if (getType(moduleObj[name]) !== "Function")
        throw new Error(`"${name}" يجب أن يكون Function`);
      api[name] = moduleObj[name](defaultFuncs, api, ctx);
    }
  };
};
