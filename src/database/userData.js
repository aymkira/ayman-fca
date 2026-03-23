// ============================================================
//  AYMAN-FCA v2.0 — User Data
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const models = require("./models");
const { DB_NOT_INIT, validateId, validateData, normalizeAttributes, normalizePayload, wrapError } = require("./helpers");

const User     = models.User;
const ID_FIELD = "userID";

function stub(userID, data) {
  return { user: { userID, ...normalizePayload(data || {}, "data") }, created: true };
}

module.exports = function(bot) {
  return {
    async create(userID, data) {
      if (!User) return stub(validateId(userID, ID_FIELD), data);
      try {
        userID      = validateId(userID, ID_FIELD);
        validateData(data);
        const payload = normalizePayload(data, "data");
        let user    = await User.findOne({ where: { userID } });
        if (user) return { user: user.get(), created: false };
        user = await User.create({ userID, ...payload });
        return { user: user.get(), created: true };
      } catch (err) { throw wrapError("Failed to create user", err); }
    },

    async get(userID) {
      if (!User) return null;
      try {
        userID    = validateId(userID, ID_FIELD);
        const user = await User.findOne({ where: { userID } });
        return user ? user.get() : null;
      } catch (err) { throw wrapError("Failed to get user", err); }
    },

    async update(userID, data) {
      if (!User) return { user: { userID: validateId(userID, ID_FIELD), ...normalizePayload(data || {}, "data") }, created: false };
      try {
        userID      = validateId(userID, ID_FIELD);
        validateData(data);
        const payload = normalizePayload(data, "data");
        const user  = await User.findOne({ where: { userID } });
        if (user) { await user.update(payload); return { user: user.get(), created: false }; }
        const newU  = await User.create({ userID, ...payload });
        return { user: newU.get(), created: true };
      } catch (err) { throw wrapError("Failed to update user", err); }
    },

    async del(userID) {
      if (!User) throw new Error(DB_NOT_INIT);
      try {
        userID      = validateId(userID, ID_FIELD);
        const result = await User.destroy({ where: { userID } });
        if (result === 0) throw new Error("No user found with the specified userID");
        return result;
      } catch (err) { throw wrapError("Failed to delete user", err); }
    },

    async delAll() {
      if (!User) return 0;
      try { return await User.destroy({ where: {} }); }
      catch (err) { throw wrapError("Failed to delete all users", err); }
    },

    async getAll(options = {}) {
      if (!User) return [];
      try {
        const query = {};
        if (options.attributes) query.attributes = normalizeAttributes(options.attributes);
        if (options.limit)  query.limit  = options.limit;
        if (options.offset) query.offset = options.offset;
        const users = await User.findAll(query);
        return users.map(u => u.get());
      } catch (err) { throw wrapError("Failed to get all users", err); }
    },

    async count() {
      if (!User) return 0;
      try { return await User.count(); }
      catch (err) { throw wrapError("Failed to count users", err); }
    }
  };
};
