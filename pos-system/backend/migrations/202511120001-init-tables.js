"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;

    // Tabla: users (alineada con src/models/User.ts)
    await queryInterface.createTable("users", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      password: { type: DataTypes.STRING(255), allowNull: false },
      role: { type: DataTypes.ENUM('admin', 'cashier', 'manager'), allowNull: false, defaultValue: 'cashier' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      avatarUrl: { type: DataTypes.STRING(255), allowNull: true },
      lastLogin: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Tabla: clients (alineada con src/models/Client.ts)
    await queryInterface.createTable("clients", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      firstName: { type: DataTypes.STRING(100), allowNull: false },
      lastName: { type: DataTypes.STRING(100), allowNull: false },
      email: { type: DataTypes.STRING(150), allowNull: true },
      phone: { type: DataTypes.STRING(20), allowNull: true },
      address: { type: DataTypes.STRING(300), allowNull: true },
      city: { type: DataTypes.STRING(100), allowNull: true },
      country: { type: DataTypes.STRING(100), allowNull: true },
      birthDate: { type: DataTypes.DATEONLY, allowNull: true },
      documentType: { type: DataTypes.ENUM('CC', 'CE', 'TI', 'PP', 'NIT'), allowNull: true },
      documentNumber: { type: DataTypes.STRING(50), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      totalPurchases: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      loyaltyPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastPurchaseDate: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Tabla: products (alineada con src/models/Product.ts)
    await queryInterface.createTable("products", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      category: { type: DataTypes.ENUM('Anillos','Alianzas','Cadenas','Collares','Pulseras','Aretes','Pendientes','Broches','Relojes','Gemelos','Dijes','Charms','Otros'), allowNull: false },
      material: { type: DataTypes.ENUM('Oro','Plata','Platino','Paladio','Acero','Titanio','Diamante','Esmeralda','Rubí','Zafiro','Perla','Otros'), allowNull: false },
      weight: { type: DataTypes.DECIMAL(8, 3), allowNull: true },
      purity: { type: DataTypes.STRING(50), allowNull: true },
      size: { type: DataTypes.STRING(50), allowNull: true },
      color: { type: DataTypes.STRING(50), allowNull: true },
      purchasePrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      salePrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      minStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      imageUrl: { type: DataTypes.STRING(255), allowNull: true },
      barcode: { type: DataTypes.STRING(255), allowNull: true },
      supplier: { type: DataTypes.STRING(255), allowNull: true },
      metal: { type: DataTypes.STRING(50), allowNull: true },
      metalPurity: { type: DataTypes.STRING(50), allowNull: true },
      grams: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
      ringSize: { type: DataTypes.STRING(50), allowNull: true },
      chainLengthCm: { type: DataTypes.INTEGER, allowNull: true },
      stoneType: { type: DataTypes.STRING(50), allowNull: true },
      stoneColor: { type: DataTypes.STRING(50), allowNull: true },
      stoneCut: { type: DataTypes.STRING(50), allowNull: true },
      stoneCarat: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      finish: { type: DataTypes.STRING(50), allowNull: true },
      plating: { type: DataTypes.STRING(50), allowNull: true },
      hallmark: { type: DataTypes.STRING(50), allowNull: true },
      collection: { type: DataTypes.STRING(100), allowNull: true },
      gender: { type: DataTypes.ENUM('hombre','mujer','unisex','niño','niña'), allowNull: true },
      isUniquePiece: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      warrantyMonths: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      metadata: { type: DataTypes.JSON, allowNull: true },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastStockUpdate: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Tabla: sales (alineada con src/models/Sale.ts)
    await queryInterface.createTable("sales", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      saleNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      clientId: { type: DataTypes.UUID, allowNull: true, references: { model: "clients", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      userId: { type: DataTypes.UUID, allowNull: false, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
      subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      paymentMethod: { type: DataTypes.ENUM('cash','card','transfer','mixed'), allowNull: false },
      status: { type: DataTypes.ENUM('pending','completed','cancelled','refunded'), allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      cardReference: { type: DataTypes.STRING(100), allowNull: true },
      transferReference: { type: DataTypes.STRING(100), allowNull: true },
      saleDate: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      saleType: { type: DataTypes.ENUM('GUIDE','STREET'), allowNull: false, defaultValue: 'STREET' },
      agencyId: { type: DataTypes.UUID, allowNull: true },
      guideId: { type: DataTypes.UUID, allowNull: true },
      employeeId: { type: DataTypes.UUID, allowNull: true },
      branchId: { type: DataTypes.UUID, allowNull: true },
      agencyCommission: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      guideCommission: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      employeeCommission: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Tabla: sale_items (alineada con src/models/SaleItem.ts)
    await queryInterface.createTable("sale_items", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      saleId: { type: DataTypes.UUID, allowNull: false, references: { model: "sales", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      productId: { type: DataTypes.UUID, allowNull: false, references: { model: "products", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
      quantity: { type: DataTypes.INTEGER, allowNull: false },
      unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      discountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });

    // Índices declarativos: ya se cubren por constraints unique y FKs en columnas.
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("sale_items");
    await queryInterface.dropTable("sales");
    await queryInterface.dropTable("products");
    await queryInterface.dropTable("clients");
    await queryInterface.dropTable("users");
  },
};
