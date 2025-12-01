"use strict";

const TABLE = "stock_transfers";

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
      productId: { type: Sequelize.STRING, allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      fromBranchId: { type: Sequelize.STRING, allowNull: false },
      toBranchId: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'requested' },
      requestedBy: { type: Sequelize.STRING, allowNull: false },
      shippedBy: { type: Sequelize.STRING },
      receivedBy: { type: Sequelize.STRING },
      reference: { type: Sequelize.STRING(200) },
      idempotencyKey: { type: Sequelize.STRING(100) },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
    });
  }

  try { await queryInterface.addIndex(TABLE, ['productId'], { name: 'idx_stock_transfers_product' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['fromBranchId'], { name: 'idx_stock_transfers_from' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['toBranchId'], { name: 'idx_stock_transfers_to' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['status'], { name: 'idx_stock_transfers_status' }); } catch {}
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await ensureTable(queryInterface, Sequelize);
  },
  down: async (queryInterface) => {
    try { await queryInterface.removeIndex(TABLE, 'idx_stock_transfers_product'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_stock_transfers_from'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_stock_transfers_to'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_stock_transfers_status'); } catch {}
    await queryInterface.dropTable(TABLE);
  },
};
