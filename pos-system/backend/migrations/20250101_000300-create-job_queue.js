"use strict";

const TABLE = "job_queue";

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
      type: { type: Sequelize.STRING(100), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'queued' },
      payload: { type: Sequelize.TEXT },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      maxAttempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
      scheduledAt: { type: Sequelize.DATE },
      availableAt: { type: Sequelize.DATE },
      lockedAt: { type: Sequelize.DATE },
      error: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
    });
  }

  try { await queryInterface.addIndex(TABLE, ['status'], { name: 'idx_job_status' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['type'], { name: 'idx_job_type' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['availableAt'], { name: 'idx_job_available' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['scheduledAt'], { name: 'idx_job_scheduled' }); } catch {}
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await ensureTable(queryInterface, Sequelize);
  },
  down: async (queryInterface) => {
    try { await queryInterface.removeIndex(TABLE, 'idx_job_status'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_job_type'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_job_available'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_job_scheduled'); } catch {}
    await queryInterface.dropTable(TABLE);
  },
};
