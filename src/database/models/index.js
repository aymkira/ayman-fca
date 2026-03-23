// ============================================================
//  AYMAN-FCA v2.0 — Database Models
//  © 2025 Ayman. All Rights Reserved.
// ============================================================
"use strict";

const { Sequelize } = require("sequelize");
const fs   = require("fs");
const path = require("path");

let sequelize = null;
let models    = {};

try {
  const dbPath = path.join(process.cwd(), "Fca_Database");
  if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

  sequelize = new Sequelize({
    dialect:        "sqlite",
    storage:        path.join(dbPath, "database.sqlite"),
    logging:        false,
    pool:           { max: 5, min: 0, acquire: 30000, idle: 10000 },
    retry:          { max: 3 },
    dialectOptions: { timeout: 5000 },
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
  });

  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".js") && f !== "index.js");
  for (const file of files) {
    try {
      const model = require(path.join(__dirname, file))(sequelize);
      if (model?.name) models[model.name] = model;
    } catch (e) {
      console.error(`[ AYMAN ] فشل تحميل نموذج ${file}:`, e?.message || e);
    }
  }

  // Associate models if method exists
  for (const name of Object.keys(models)) {
    if (typeof models[name].associate === "function") {
      try { models[name].associate(models); } catch (_) {}
    }
  }

  sequelize.sync({ alter: false }).catch(e => {
    console.error("[ AYMAN ] Database sync error:", e?.message || e);
  });

} catch (e) {
  console.error("[ AYMAN ] Database init error:", e?.message || e);
  sequelize = null;
  models    = {};
}

module.exports = { sequelize, models, Thread: models.Thread || null, User: models.User || null };
