"use strict";

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface) => {
    // Crear usuario admin por defecto alineado con el modelo User
    const id = crypto.randomUUID();
    const username = 'admin';
    const email = 'admin@example.local';
    const password = await bcrypt.hash('admin123', 12);
    const now = new Date();

    await queryInterface.bulkInsert("users", [{
      id,
      username,
      email,
      password,
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete("users", { username: 'admin' }, {});
  },
};
