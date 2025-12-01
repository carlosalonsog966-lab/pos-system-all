"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;

    await queryInterface.createTable("product_assets", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      productId: { type: DataTypes.UUID, allowNull: false, references: { model: "products", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      serial: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      status: { type: DataTypes.ENUM('available', 'reserved', 'sold', 'service'), allowNull: false, defaultValue: 'available' },
      hallmark: { type: DataTypes.STRING(50), allowNull: true },
      condition: { type: DataTypes.STRING(50), allowNull: true },
      location: { type: DataTypes.STRING(100), allowNull: true },
      qrPayload: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("product_assets");
  },
};

