// ============================================================
//  AYMAN-FCA v2.0 — Middleware System
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const logger = require("../../../../func/logger");

module.exports = function createMiddlewareSystem() {
  const stack = [];

  function use(middleware, fn) {
    let mFn, name;
    if (typeof middleware === "string" && typeof fn === "function") {
      name = middleware; mFn = fn;
    } else if (typeof middleware === "function") {
      mFn = middleware; name = `mw_${stack.length}`;
    } else throw new Error("Middleware يجب أن يكون function أو (name, function)");

    const wrapped = { name, fn: mFn, enabled: true };
    stack.push(wrapped);

    return function remove() {
      const i = stack.indexOf(wrapped);
      if (i !== -1) stack.splice(i, 1);
    };
  }

  function remove(id) {
    const i = typeof id === "string"
      ? stack.findIndex(m => m.name === id)
      : stack.findIndex(m => m.fn === id);
    if (i !== -1) { stack.splice(i, 1); return true; }
    return false;
  }

  function clear() { const n = stack.length; stack.length = 0; return n; }
  function list()  { return stack.filter(m => m.enabled).map(m => m.name); }

  function setEnabled(name, enabled) {
    const m = stack.find(m => m.name === name);
    if (m) { m.enabled = enabled; return true; }
    return false;
  }

  function process(event, finalCb) {
    const enabled = stack.filter(m => m.enabled);
    if (!enabled.length) return finalCb(null, event);
    let idx = 0;
    function next(err) {
      if (err === false || err === null) return finalCb(null, null);
      if (err && err !== true)          return finalCb(err, null);
      if (idx >= enabled.length)        return finalCb(null, event);
      const mw = enabled[idx++];
      try {
        const r = mw.fn(event, next);
        if (r && typeof r.then === "function") r.then(() => next()).catch(e => next(e));
        else if (r === false || r === null) finalCb(null, null);
      } catch (e) { next(e); }
    }
    next();
  }

  function wrapCallback(cb) {
    return function(err, event) {
      if (err)    return cb(err, null);
      if (!event) return cb(null, null);
      process(event, (mErr, processed) => {
        if (mErr)          return cb(mErr, null);
        if (processed === null) return;
        cb(null, processed);
      });
    };
  }

  return {
    use, remove, clear, list, setEnabled, process, wrapCallback,
    get count() { return stack.filter(m => m.enabled).length; }
  };
};
