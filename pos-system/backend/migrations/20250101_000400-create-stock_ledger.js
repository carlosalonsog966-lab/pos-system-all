"use strict";

const TABLE = "stock_ledger";

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
      branchId: { type: Sequelize.STRING },
      movementType: { type: Sequelize.STRING(50), allowNull: false },
      quantityChange: { type: Sequelize.INTEGER, allowNull: false },
      unitCost: { type: Sequelize.DECIMAL(12, 4) },
      referenceType: { type: Sequelize.STRING(50) },
      referenceId: { type: Sequelize.STRING },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
    });
  }

  try { await queryInterface.addIndex(TABLE, ['productId'], { name: 'idx_ledger_product' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['branchId'], { name: 'idx_ledger_branch' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['createdAt'], { name: 'idx_ledger_createdAt' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['referenceType', 'referenceId'], { name: 'idx_ledger_ref' }); } catch {}
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await ensureTable(queryInterface, Sequelize);
  },
  down: async (queryInterface) => {
    try { await queryInterface.removeIndex(TABLE, 'idx_ledger_product'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_ledger_branch'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_ledger_createdAt'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_ledger_ref'); } catch {}
    await queryInterface.dropTable(TABLE);
  },
};
