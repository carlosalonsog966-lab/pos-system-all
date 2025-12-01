"use strict";

const TABLE = "cycle_counts";

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
      branchId: { type: Sequelize.STRING },
      type: { type: Sequelize.STRING(20), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'pending' },
      createdBy: { type: Sequelize.STRING, allowNull: false },
      startedAt: { type: Sequelize.DATE },
      completedAt: { type: Sequelize.DATE },
      tolerancePct: { type: Sequelize.DECIMAL(5, 2) },
      note: { type: Sequelize.STRING(1000) },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
    });
  }

  try { await queryInterface.addIndex(TABLE, ['branchId'], { name: 'idx_cycle_counts_branch' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['status'], { name: 'idx_cycle_counts_status' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['createdAt'], { name: 'idx_cycle_counts_createdAt' }); } catch {}
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await ensureTable(queryInterface, Sequelize);
  },
  down: async (queryInterface) => {
    try { await queryInterface.removeIndex(TABLE, 'idx_cycle_counts_branch'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_cycle_counts_status'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_cycle_counts_createdAt'); } catch {}
    await queryInterface.dropTable(TABLE);
  },
};
