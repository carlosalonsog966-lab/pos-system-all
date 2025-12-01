const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'pos_system.db');
const db = new sqlite3.Database(dbPath);

// Create settings table
const createSettingsTable = `
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  companyName TEXT NOT NULL DEFAULT 'Mi Empresa',
  companyAddress TEXT,
  companyPhone TEXT,
  companyEmail TEXT,
  companyTaxId TEXT,
  companyLogo TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  locale TEXT DEFAULT 'es-CO',
  taxRate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  receiptFooter TEXT,
  autoPrint BOOLEAN NOT NULL DEFAULT 0,
  printerName TEXT,
  lowStockAlert BOOLEAN NOT NULL DEFAULT 1,
  lowStockThreshold INTEGER NOT NULL DEFAULT 10,
  dailyReports BOOLEAN NOT NULL DEFAULT 0,
  emailNotifications BOOLEAN NOT NULL DEFAULT 0,
  sessionTimeout INTEGER NOT NULL DEFAULT 30,
  maxLoginAttempts INTEGER NOT NULL DEFAULT 5,
  requireTwoFactor BOOLEAN NOT NULL DEFAULT 0,
  passwordExpiry INTEGER NOT NULL DEFAULT 90,
  autoBackup BOOLEAN NOT NULL DEFAULT 0,
  backupFrequency TEXT NOT NULL DEFAULT 'weekly',
  backupLocation TEXT,
  cloudBackup BOOLEAN NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'light',
  primaryColor TEXT,
  barcodeFormat TEXT NOT NULL DEFAULT 'CODE128',
  enableInventoryTracking BOOLEAN NOT NULL DEFAULT 1,
  enableCustomerManagement BOOLEAN NOT NULL DEFAULT 1,
  inventoryFilterPresets TEXT DEFAULT '[]',
  createdAt DATETIME,
  updatedAt DATETIME
);
`;

// Insert default settings
const defaultSettings = {
  id: 'default-settings-1',
  companyName: 'Joyería POS System',
  companyAddress: 'Calle Principal #123',
  companyPhone: '+57 123 456 7890',
  companyEmail: 'info@joyeria.com',
  companyTaxId: '123456789-0',
  currency: 'COP',
  locale: 'es-CO',
  taxRate: 0.1900,
  lowStockAlert: true,
  lowStockThreshold: 5,
  dailyReports: true,
  emailNotifications: false,
  sessionTimeout: 60,
  maxLoginAttempts: 5,
  requireTwoFactor: false,
  passwordExpiry: 90,
  autoBackup: true,
  backupFrequency: 'daily',
  cloudBackup: false,
  theme: 'light',
  primaryColor: '#D4AF37',
  barcodeFormat: 'CODE128',
  enableInventoryTracking: true,
  enableCustomerManagement: true,
  inventoryFilterPresets: '[]',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

db.serialize(() => {
  // Create table
  db.run(createSettingsTable, (err) => {
    if (err) {
      console.error('Error creating settings table:', err);
      return;
    }
    console.log('Settings table created successfully');
  });

  // Insert default settings
  const insertQuery = `
    INSERT OR IGNORE INTO settings (
      id, companyName, companyAddress, companyPhone, companyEmail, companyTaxId,
      currency, locale, taxRate, lowStockAlert, lowStockThreshold, dailyReports,
      emailNotifications, sessionTimeout, maxLoginAttempts, requireTwoFactor,
      passwordExpiry, autoBackup, backupFrequency, cloudBackup, theme,
      primaryColor, barcodeFormat, enableInventoryTracking, enableCustomerManagement,
      inventoryFilterPresets, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    defaultSettings.id,
    defaultSettings.companyName,
    defaultSettings.companyAddress,
    defaultSettings.companyPhone,
    defaultSettings.companyEmail,
    defaultSettings.companyTaxId,
    defaultSettings.currency,
    defaultSettings.locale,
    defaultSettings.taxRate,
    defaultSettings.lowStockAlert,
    defaultSettings.lowStockThreshold,
    defaultSettings.dailyReports,
    defaultSettings.emailNotifications,
    defaultSettings.sessionTimeout,
    defaultSettings.maxLoginAttempts,
    defaultSettings.requireTwoFactor,
    defaultSettings.passwordExpiry,
    defaultSettings.autoBackup,
    defaultSettings.backupFrequency,
    defaultSettings.cloudBackup,
    defaultSettings.theme,
    defaultSettings.primaryColor,
    defaultSettings.barcodeFormat,
    defaultSettings.enableInventoryTracking,
    defaultSettings.enableCustomerManagement,
    defaultSettings.inventoryFilterPresets,
    defaultSettings.createdAt,
    defaultSettings.updatedAt
  ];

  db.run(insertQuery, values, (err) => {
    if (err) {
      console.error('Error inserting default settings:', err);
    } else {
      console.log('Default settings inserted successfully');
    }
  });
});

db.close(() => {
  console.log('Settings migration completed');
});