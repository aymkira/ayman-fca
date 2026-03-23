// ============================================================
//  AYMAN-FCA v2.0 — Message Scheduler
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const logger = require("../../../func/logger");

module.exports = function(defaultFuncs, api, ctx) {
  if (!ctx._scheduler) ctx._scheduler = createScheduler(api);
  return ctx._scheduler;
};

function createScheduler(api) {
  const jobs  = new Map();
  let nextId  = 1;

  function parseWhen(when) {
    if (when instanceof Date)   return when.getTime();
    if (typeof when === "number") return when;
    if (typeof when === "string") return new Date(when).getTime();
    throw new Error("when يجب أن يكون Date أو number أو ISO string");
  }

  function schedule(message, threadID, when, options = {}, callback) {
    if (typeof options === "function") { callback = options; options = {}; }

    const ts = parseWhen(when);
    const now = Date.now();
    if (ts <= now) {
      const err = new Error("الوقت المحدد في الماضي");
      if (callback) callback(err);
      return null;
    }

    const id  = String(nextId++);
    const delay = ts - now;

    const timer = setTimeout(async () => {
      const job = jobs.get(id);
      if (!job || job.cancelled) return;
      jobs.delete(id);

      const targets = Array.isArray(threadID) ? threadID : [threadID];
      for (const tid of targets) {
        try {
          await api.sendMessage(message, tid);
          logger(`[ Scheduler ] رسالة أُرسلت ✅ → ${tid}`, "info");
          if (callback) callback(null, { id, threadID: tid, message });
        } catch (e) {
          logger(`[ Scheduler ] فشل الإرسال → ${tid}: ${e?.message || e}`, "error");
          if (callback) callback(e);
        }
      }
    }, delay);

    jobs.set(id, { id, message, threadID, timestamp: ts, timer, options, cancelled: false, createdAt: now });
    logger(`[ Scheduler ] جُدولت رسالة #${id} بعد ${Math.round(delay / 1000)}s`, "info");
    return id;
  }

  function cancel(id) {
    const job = jobs.get(String(id));
    if (!job) return false;
    clearTimeout(job.timer);
    job.cancelled = true;
    jobs.delete(String(id));
    logger(`[ Scheduler ] تم إلغاء الرسالة #${id}`, "info");
    return true;
  }

  function cancelAll() {
    let count = 0;
    for (const [id, job] of jobs) {
      clearTimeout(job.timer);
      job.cancelled = true;
      count++;
    }
    jobs.clear();
    logger(`[ Scheduler ] تم إلغاء ${count} رسالة`, "info");
    return count;
  }

  function list() {
    return Array.from(jobs.values()).map(j => ({
      id:        j.id,
      threadID:  j.threadID,
      timestamp: j.timestamp,
      createdAt: j.createdAt,
      remaining: Math.max(0, j.timestamp - Date.now())
    }));
  }

  function destroy() {
    cancelAll();
    logger("[ Scheduler ] تم التدمير", "info");
  }

  return { schedule, cancel, cancelAll, list, destroy };
}
