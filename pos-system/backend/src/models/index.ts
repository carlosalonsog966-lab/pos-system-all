import { sequelize } from '../db/config';
import { User, initializeUser } from './User';
import { Product, initializeProduct } from './Product';
import { Client, initializeClient } from './Client';
import { Sale, initializeSale } from './Sale';
import { SaleItem, initializeSaleItem } from './SaleItem';
import { CashRegister, initializeCashRegister } from './CashRegister';
import { CashCount, initializeCashCount } from './CashCount';
import { Settings, initializeSettings } from './Settings';
import Agency from './Agency';
import Guide from './Guide';
import Employee from './Employee';
import Branch from './Branch';
import DailyGuideReport from './DailyGuideReport';
import Barcode from './Barcode';
import { GuideRegistration } from './GuideRegistration';
import { setupAssociations } from './associations';
import ProductAsset, { initializeProductAsset } from './ProductAsset';
import EventLog, { initializeEventLog } from './EventLog';
import StoredFile, { initializeStoredFile } from './StoredFile';
import AuditTrail, { initializeAuditTrail } from './AuditTrail';
import JobQueue, { initializeJobQueue } from './JobQueue';
import StockLedger, { initializeStockLedger } from './StockLedger';
import FilterPreset, { initializeFilterPreset } from './FilterPreset';
import Certification, { initializeCertification } from './Certification';
import Warranty, { initializeWarranty } from './Warranty';
import Appraisal, { initializeAppraisal } from './Appraisal';
import CycleCount, { initializeCycleCount } from './CycleCount';
import CycleCountItem, { initializeCycleCountItem } from './CycleCountItem';
import StockTransfer, { initializeStockTransfer } from './StockTransfer';

// Función para inicializar modelos y asociaciones
export const initializeModels = () => {
  console.log('Initializing models...');
  
  // Inicializar cada modelo con la instancia de Sequelize
  initializeUser(sequelize);
  initializeProduct(sequelize);
  initializeClient(sequelize);
  initializeSale(sequelize);
  initializeSaleItem(sequelize);
  initializeCashRegister(sequelize);
  initializeCashCount(sequelize);
  initializeSettings(sequelize);
  initializeEventLog();
  initializeStoredFile(sequelize);
  initializeAuditTrail(sequelize);
  initializeJobQueue(sequelize);
  initializeStockLedger(sequelize);
  initializeFilterPreset();
  initializeProductAsset(sequelize);
  initializeCertification(sequelize);
  initializeWarranty(sequelize);
  initializeAppraisal(sequelize);
  initializeCycleCount(sequelize);
  initializeCycleCountItem(sequelize);
  initializeStockTransfer(sequelize);
  
  // Configurar asociaciones después de inicializar todos los modelos
  setupAssociations();
  
  console.log('Models and associations initialized successfully');
  
  // Return models for use in other files
  return {
    User,
    Product,
    Client,
    Sale,
    SaleItem,
    CashRegister,
    CashCount,
    Settings,
    Agency,
    Guide,
    Employee,
    Branch,
    DailyGuideReport,
    Barcode,
    GuideRegistration,
    EventLog,
    StoredFile,
    AuditTrail,
    JobQueue,
    StockLedger,
    FilterPreset,
    ProductAsset,
    Certification,
    Warranty,
    Appraisal,
    CycleCount,
    CycleCountItem,
    StockTransfer,
  };
};

// Export default object with sequelize
export default {
  sequelize,
  initializeModels,
};

// Export models individually
export {
  User,
  Product,
  Client,
  Sale,
  SaleItem,
  CashRegister,
  CashCount,
  Settings,
  Agency,
  Guide,
  Employee,
  Branch,
  DailyGuideReport,
  Barcode,
  GuideRegistration,
  EventLog,
  StoredFile,
  AuditTrail,
  JobQueue,
  StockLedger,
  FilterPreset,
};

// Sync function for development
export const syncDatabase = async (force = false) => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    await sequelize.sync({ force });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};
