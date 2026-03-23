// ============================================================
//  AYMAN-FCA v2.0 — HTTP POST
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { post }    = require("../../utils/request");
const { getType } = require("../../utils/format");

module.exports = function(defaultFuncs, api, ctx) {
  return function httpPost(url, form, callback, notAPI) {
    let resolve, reject;
    const p = new Promise((res, rej) => { resolve = res; reject = rej; });

    if (!callback && (getType(form) === "Function" || getType(form) === "AsyncFunction")) {
      callback = form; form = {};
    }
    form     = form || {};
    callback = callback || ((err, data) => err ? reject(err) : resolve(data));

    const executor = notAPI ? post : defaultFuncs.post;
    executor(url, ctx.jar, form, ctx.globalOptions)
      .then(res => {
        let data = res?.data ?? res;
        if (data && typeof data === "object") data = JSON.stringify(data, null, 2);
        callback(null, data);
      })
      .catch(err => callback(err));

    return p;
  };
};
