// ============================================================
//  AYMAN-FCA v2.0 — Thread Data
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const models = require("./models");
const { DB_NOT_INIT, validateId, validateData, normalizeAttributes, wrapError } = require("./helpers");

const Thread   = models.Thread;
const ID_FIELD = "threadID";

module.exports = function(bot) {
  return {
    async create(threadID, data) {
      if (!Thread) return { thread: { threadID: validateId(threadID, ID_FIELD), ...(data || {}) }, created: true };
      try {
        threadID    = validateId(threadID, ID_FIELD);
        let thread  = await Thread.findOne({ where: { threadID } });
        if (thread) return { thread: thread.get(), created: false };
        thread = await Thread.create({ threadID, ...(data || {}) });
        return { thread: thread.get(), created: true };
      } catch (err) { throw wrapError("Failed to create thread", err); }
    },

    async get(threadID) {
      if (!Thread) return null;
      try {
        threadID     = validateId(threadID, ID_FIELD);
        const thread = await Thread.findOne({ where: { threadID } });
        return thread ? thread.get() : null;
      } catch (err) { throw wrapError("Failed to get thread", err); }
    },

    async update(threadID, data) {
      if (!Thread) return { thread: { threadID: validateId(threadID, ID_FIELD), ...(data || {}) }, created: false };
      try {
        threadID    = validateId(threadID, ID_FIELD);
        validateData(data);
        const thread = await Thread.findOne({ where: { threadID } });
        if (thread) { await thread.update(data); return { thread: thread.get(), created: false }; }
        const newT = await Thread.create({ ...data, threadID });
        return { thread: newT.get(), created: true };
      } catch (err) { throw wrapError("Failed to update thread", err); }
    },

    async del(threadID) {
      if (!Thread) throw new Error(DB_NOT_INIT);
      try {
        threadID     = validateId(threadID, ID_FIELD);
        const result = await Thread.destroy({ where: { threadID } });
        if (result === 0) throw new Error("No thread found with the specified threadID");
        return result;
      } catch (err) { throw wrapError("Failed to delete thread", err); }
    },

    async delAll() {
      if (!Thread) return 0;
      try { return await Thread.destroy({ where: {} }); }
      catch (err) { throw wrapError("Failed to delete all threads", err); }
    },

    async getAll(options = {}) {
      if (!Thread) return [];
      try {
        const query = {};
        if (options.attributes) query.attributes = normalizeAttributes(options.attributes);
        if (options.limit)  query.limit  = options.limit;
        if (options.offset) query.offset = options.offset;
        const threads = await Thread.findAll(query);
        return threads.map(t => t.get());
      } catch (err) { throw wrapError("Failed to get all threads", err); }
    },

    async count() {
      if (!Thread) return 0;
      try { return await Thread.count(); }
      catch (err) { throw wrapError("Failed to count threads", err); }
    },

    async incrementMessageCount(threadID, amount = 1) {
      if (!Thread) return null;
      try {
        threadID     = validateId(threadID, ID_FIELD);
        const thread = await Thread.findOne({ where: { threadID } });
        if (!thread) return null;
        await thread.increment("messageCount", { by: amount });
        return thread.get();
      } catch (err) { throw wrapError("Failed to increment message count", err); }
    }
  };
};
