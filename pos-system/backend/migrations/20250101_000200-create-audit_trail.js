"use strict";

const TABLE = "audit_trail";

function getDateDefault(Sequelize) {
  return Sequelize.literal('CURRENT_TIMESTAMP');
}

async function tableExists(queryInterface, tableName) {
  const dialect = queryInterface.sequelize.getDialect();
  let sql;
  if (dialect === 'sqlite') {
    sql = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
  } else if (dialect === 'mysql') {
    sql = `SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '${tableName}'`;
  } else if (dialect === 'postgres') {
    sql = `SELECT to_regclass('${tableName}') AS name`;
  } else {
    sql = '';
  }
  if (!sql) return false;
  try {
    const [rows] = await queryInterface.sequelize.query(sql);
    if (dialect === 'postgres') {
      const r = Array.isArray(rows) ? rows[0] : rows;
      return !!(r && r.name);
    }
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function ensureTable(queryInterface, Sequelize) {
  const exists = await tableExists(queryInterface, TABLE);
  if (!exists) {
    await queryInterface.createTable(TABLE, {
      id: { type: Sequelize.STRING, primaryKey: true },
      operation: { type: Sequelize.STRING(100), allowNull: false },
      entityType: { type: Sequelize.STRING(50) },
      entityId: { type: Sequelize.STRING },
      actorId: { type: Sequelize.STRING },
      actorRole: { type: Sequelize.STRING(50) },
      result: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'success' },
      message: { type: Sequelize.STRING(255) },
      details: { type: Sequelize.TEXT },
      correlationId: { type: Sequelize.STRING(100) },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
    });
  }

  try { await queryInterface.addIndex(TABLE, ['operation'], { name: 'idx_audit_operation' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['entityType', 'entityId'], { name: 'idx_audit_entity' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['actorId'], { name: 'idx_audit_actor' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['createdAt'], { name: 'idx_audit_createdAt' }); } catch {}
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await ensureTable(queryInterface, Sequelize);
  },
  down: async (queryInterface) => {
    try { await queryInterface.removeIndex(TABLE, 'idx_audit_operation'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_audit_entity'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_audit_actor'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_audit_createdAt'); } catch {}
    await queryInterface.dropTable(TABLE);
  },
};
