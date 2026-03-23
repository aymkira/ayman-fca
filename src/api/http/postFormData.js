// ============================================================
//  AYMAN-FCA v2.0 — HTTP POST Form Data
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { postFormData } = require("../../utils/request");
const { getType }      = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function httpPostFormData(url, form, callback) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });

    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    postFormData(url, ctx.jar, form || {}, {}, ctx.globalOptions, ctx)
      .then(res => callback(null, res?.data ?? res))
      .catch(err => callback(err));

    return p;
  };
};
