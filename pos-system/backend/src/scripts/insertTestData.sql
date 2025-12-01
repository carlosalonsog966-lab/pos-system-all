-- Insertar usuario de prueba
INSERT INTO users (id, username, email, password, role, isActive, createdAt, updatedAt) 
VALUES (
  '12345678-9abc-def0-1234-56789abcdef0',
  'admin',
  'admin@example.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: admin123
  'admin',
  1,
  datetime('now'),
  datetime('now')
);

-- Insertar cliente de prueba
INSERT INTO clients (id, code, firstName, lastName, email, phone, address, city, isActive, totalPurchases, createdAt, updatedAt)
VALUES (
  '87654321-9abc-def0-1234-56789abcdef0',
  'CLI-001',
  'Juan',
  'Pérez',
  'juan.perez@example.com',
  '+57 300 123 4567',
  'Calle 123 #45-67',
  'Bogotá',
  1,
  0,
  datetime('now'),
  datetime('now')
);

-- Insertar productos de prueba
INSERT INTO products (id, code, name, description, category, material, weight, purity, purchasePrice, salePrice, stock, minStock, isActive, createdAt, updatedAt)
VALUES 
(
  'prod-1234-5678-9abc-def0',
  'ANI-ORO-001',
  'Anillo de Oro 18k',
  'Anillo de oro de 18 quilates con diseño clásico',
  'rings',
  'gold',
  5.2,
  '18K',
  600000,
  850000,
  10,
  2,
  1,
  datetime('now'),
  datetime('now')
),
(
  'prod-2345-6789-abcd-ef01',
  'COL-PLA-001',
  'Collar de Plata',
  'Collar de plata 925 con cadena de 45cm',
  'necklaces',
  'silver',
  12.5,
  '925',
  200000,
  320000,
  15,
  3,
  1,
  datetime('now'),
  datetime('now')
);

-- Insertar venta de prueba
INSERT INTO sales (id, saleNumber, saleDate, clientId, userId, subtotal, discountAmount, taxAmount, total, paymentMethod, status, notes, createdAt, updatedAt)
VALUES (
  'sale-1234-5678-9abc-def0',
  'VTA-001',
  datetime('now'),
  '87654321-9abc-def0-1234-56789abcdef0',
  '12345678-9abc-def0-1234-56789abcdef0',
  1170000,
  50000,
  187200,
  1307200,
  'card',
  'completed',
  'Venta de prueba para sistema de tickets',
  datetime('now'),
  datetime('now')
);

-- Insertar items de la venta
INSERT INTO sale_items (id, saleId, productId, quantity, unitPrice, subtotal, discountAmount, total, createdAt, updatedAt)
VALUES 
(
  'item-1234-5678-9abc-def0',
  'sale-1234-5678-9abc-def0',
  'prod-1234-5678-9abc-def0',
  1,
  850000,
  850000,
  0,
  850000,
  datetime('now'),
  datetime('now')
),
(
  'item-2345-6789-abcd-ef01',
  'sale-1234-5678-9abc-def0',
  'prod-2345-6789-abcd-ef01',
  1,
  320000,
  320000,
  0,
  320000,
  datetime('now'),
  datetime('now')
);