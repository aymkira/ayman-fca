// ============================================================
//  AYMAN-FCA v2.0 — Thread Model
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

module.exports = function(sequelize) {
  const { Model, DataTypes } = require("sequelize");

  class Thread extends Model {}

  Thread.init({
    num: {
      type:          DataTypes.INTEGER,
      allowNull:     false,
      autoIncrement: true,
      primaryKey:    true
    },
    threadID: {
      type:      DataTypes.STRING,
      allowNull: false,
      unique:    true
    },
    messageCount: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0
    },
    data: {
      type:      DataTypes.TEXT,
      allowNull: true,
      get() {
        const v = this.getDataValue("data");
        if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } }
        return v;
      },
      set(v) {
        this.setDataValue("data", typeof v === "string" ? v : JSON.stringify(v));
      }
    }
  }, { sequelize, modelName: "Thread", timestamps: true });

  return Thread;
};
