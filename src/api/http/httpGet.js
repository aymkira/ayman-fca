// ============================================================
//  AYMAN-FCA v2.0 — HTTP GET
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { getType } = require("../../utils/format");
const { get }     = require("../../utils/request");

module.exports = function(defaultFuncs, api, ctx) {
  return function httpGet(url, form, callback, notAPI) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });

    if (!callback && (getType(form) === "Function" || getType(form) === "AsyncFunction")) {
      callback = form; form = {};
    }
    form     = form || {};
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    const executor = notAPI ? get : defaultFuncs.get;
    executor(url, ctx.jar, form)
      .then(res => callback(null, res?.data ?? res))
      .catch(err => callback(err));

    return p;
  };
};
