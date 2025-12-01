"use strict";

const TABLE = "files";

function getDateDefault(Sequelize) {
  // CURRENT_TIMESTAMP funciona en MySQL, Postgres y SQLite
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
    // Fallback genérico: intentar y asumir que no existe
    sql = '';
  }
  if (!sql) return false;
  try {
    const [rows] = await queryInterface.sequelize.query(sql);
    if (dialect === 'postgres') {
      // to_regclass devuelve null si no existe
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
      filename: { type: Sequelize.STRING(255), allowNull: false },
      mimeType: { type: Sequelize.STRING(100) },
      size: { type: Sequelize.INTEGER },
      checksum: { type: Sequelize.STRING(64), allowNull: false },
      storage: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'local' },
      path: { type: Sequelize.STRING(500), allowNull: false },
      entityType: { type: Sequelize.STRING(50) },
      entityId: { type: Sequelize.STRING },
      metadata: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: getDateDefault(Sequelize) },
    });
  }

  // Índices
  try { await queryInterface.addIndex(TABLE, ['checksum'], { unique: true, name: 'idx_files_checksum' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['entityType', 'entityId'], { name: 'idx_files_entity' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['createdAt'], { name: 'idx_files_createdAt' }); } catch {}
  try { await queryInterface.addIndex(TABLE, ['filename'], { name: 'idx_files_filename' }); } catch {}
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await ensureTable(queryInterface, Sequelize);
  },
  down: async (queryInterface) => {
    try { await queryInterface.removeIndex(TABLE, 'idx_files_checksum'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_files_entity'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_files_createdAt'); } catch {}
    try { await queryInterface.removeIndex(TABLE, 'idx_files_filename'); } catch {}
    await queryInterface.dropTable(TABLE);
  },
};
