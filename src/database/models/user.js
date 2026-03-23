// ============================================================
//  AYMAN-FCA v2.0 — User Model
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

module.exports = function(sequelize) {
  const { Model, DataTypes } = require("sequelize");

  class User extends Model {}

  User.init({
    num: {
      type:          DataTypes.INTEGER,
      allowNull:     false,
      autoIncrement: true,
      primaryKey:    true
    },
    userID: {
      type:      DataTypes.STRING,
      allowNull: false,
      unique:    true
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
  }, { sequelize, modelName: "User", timestamps: true });

  return User;
};
