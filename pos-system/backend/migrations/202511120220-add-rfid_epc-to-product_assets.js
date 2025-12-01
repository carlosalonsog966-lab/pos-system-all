"use strict";

const TABLE = "product_assets";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addColumn(TABLE, 'rfidEpc', { type: Sequelize.STRING(128), allowNull: true });
    } catch {}
    try { await queryInterface.addIndex(TABLE, ['rfidEpc'], { name: 'idx_product_assets_rfidEpc' }); } catch {}
  },
  down: async (queryInterface) => {
    try { await queryInterface.removeIndex(TABLE, 'idx_product_assets_rfidEpc'); } catch {}
    try { await queryInterface.removeColumn(TABLE, 'rfidEpc'); } catch {}
  },
};
