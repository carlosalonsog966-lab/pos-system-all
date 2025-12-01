import { sequelize } from '../db/config';
import { Settings } from '../models/Settings';

async function seedRealSettings() {
  try {
    console.log('🌱 Iniciando seed de settings con valores reales...');
    
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida');
    
    // Inicializar el modelo
    await Settings.sync();
    console.log('✅ Modelo Settings sincronizado');
    
    // Buscar el settings actual
    const existingSettings = await Settings.findOne({ where: { id: 'default-settings-1' } });
    
    let updatedSettings;
    
    if (existingSettings) {
      console.log('✅ Settings existentes encontrados, actualizando...');
      // Actualizar con valores reales
      updatedSettings = await existingSettings.update({
      companyLogo: '/uploads/logos/joyeria-logo.png',
      receiptFooter: 'Gracias por su compra. Joyería POS System - Calidad y Confianza. Tel: +57 123 456 7890',
      printerName: 'EPSON TM-T20III',
      backupLocation: 'C:\\POS_Backups',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date()
      });
    } else {
      console.log('✅ No hay settings existentes, creando nuevos con valores reales...');
      // Crear settings con valores reales
      updatedSettings = await Settings.create({
        id: 'default-settings-1',
        companyName: 'Joyería POS System',
        companyAddress: 'Calle Principal #123',
        companyPhone: '+57 123 456 7890',
        companyEmail: 'info@joyeria.com',
        companyTaxId: '123456789-0',
        companyLogo: '/uploads/logos/joyeria-logo.png',
        currency: 'COP',
        locale: 'es-CO',
        taxRate: 0.19,
        receiptFooter: 'Gracias por su compra. Joyería POS System - Calidad y Confianza. Tel: +57 123 456 7890',
        autoPrint: false,
        printerName: 'EPSON TM-T20III',
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
        backupLocation: 'C:\\POS_Backups',
        cloudBackup: false,
        theme: 'light',
        primaryColor: '#D4AF37',
        barcodeFormat: 'CODE128',
        enableInventoryTracking: true,
        enableCustomerManagement: true,
        inventoryFilterPresets: '[]',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date()
      });
    }
    
    console.log('✅ Settings actualizados/creados con valores reales:');
    console.log('  - Logo:', updatedSettings.companyLogo);
    console.log('  - Footer de recibo:', updatedSettings.receiptFooter);
    console.log('  - Impresora:', updatedSettings.printerName);
    console.log('  - Ubicación de backup:', updatedSettings.backupLocation);
    console.log('  - Timestamps creados');
    
    // Verificar que el directorio de backups existe
    const fs = require('fs');
    const path = require('path');
    
    const backupDir = updatedSettings.backupLocation;
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`✅ Directorio de backups creado: ${backupDir}`);
    } else {
      console.log(`✅ Directorio de backups ya existe: ${backupDir}`);
    }
    
    // Crear directorio de logos si no existe
    const logosDir = path.join(process.cwd(), '..', 'uploads', 'logos');
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
      console.log(`✅ Directorio de logos creado: ${logosDir}`);
    } else {
      console.log(`✅ Directorio de logos ya existe: ${logosDir}`);
    }
    
    console.log('🎉 Seed de settings completado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en seed de settings:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Conexión a base de datos cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  seedRealSettings();
}