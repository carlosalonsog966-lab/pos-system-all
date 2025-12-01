import { User } from './User';
import { Product } from './Product';
import ProductAsset from './ProductAsset';
import { Client } from './Client';
import { Sale } from './Sale';
import { SaleItem } from './SaleItem';
import { CashRegister } from './CashRegister';
import { CashCount } from './CashCount';
import Agency from './Agency';
import Guide from './Guide';
import Employee from './Employee';
import Branch from './Branch';
import DailyGuideReport from './DailyGuideReport';
import Barcode from './Barcode';

export const setupAssociations = () => {
  console.log('Setting up model associations...');

  // Sale associations
  Sale.belongsTo(Client, { 
    foreignKey: 'clientId', 
    as: 'client',
    constraints: false // Permite clientId null
  });
  
  Sale.belongsTo(User, { 
    foreignKey: 'userId', 
    as: 'user' 
  });
  
  Sale.hasMany(SaleItem, { 
    foreignKey: 'saleId', 
    as: 'items' 
  });

  // Client associations
  Client.hasMany(Sale, { 
    foreignKey: 'clientId', 
    as: 'sales' 
  });

  // User associations
  User.hasMany(Sale, { 
    foreignKey: 'userId', 
    as: 'sales' 
  });
  
  User.hasMany(CashRegister, { 
    foreignKey: 'userId', 
    as: 'cashRegisters' 
  });

  // SaleItem associations
  SaleItem.belongsTo(Sale, { 
    foreignKey: 'saleId', 
    as: 'sale' 
  });
  
  SaleItem.belongsTo(Product, { 
    foreignKey: 'productId', 
    as: 'product' 
  });

  // Product associations
  Product.hasMany(SaleItem, { 
    foreignKey: 'productId', 
    as: 'saleItems' 
  });

  

  // CashRegister associations
  CashRegister.belongsTo(User, { 
    foreignKey: 'userId', 
    as: 'user' 
  });

  // CashCount associations
  CashCount.belongsTo(CashRegister, {
    foreignKey: 'cashRegisterId',
    as: 'cashRegister'
  });

  CashCount.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });

  CashRegister.hasMany(CashCount, {
    foreignKey: 'cashRegisterId',
    as: 'counts'
  });

  User.hasMany(CashCount, {
    foreignKey: 'userId',
    as: 'cashCounts'
  });

  // Tourism System Associations
  
  // Agency associations
  Agency.hasMany(Guide, { 
    foreignKey: 'agencyId', 
    as: 'guides' 
  });
  
  Agency.hasMany(Sale, { 
    foreignKey: 'agencyId', 
    as: 'sales' 
  });

  // Guide associations
  Guide.belongsTo(Agency, { 
    foreignKey: 'agencyId', 
    as: 'agency' 
  });
  
  Guide.hasMany(Sale, { 
    foreignKey: 'guideId', 
    as: 'sales' 
  });
  
  Guide.hasMany(DailyGuideReport, { 
    foreignKey: 'guideId', 
    as: 'dailyReports' 
  });

  // Employee associations
  Employee.belongsTo(Branch, { 
    foreignKey: 'branchId', 
    as: 'branch' 
  });
  
  Employee.hasMany(Sale, { 
    foreignKey: 'employeeId', 
    as: 'sales' 
  });

  // Branch associations
  Branch.hasMany(Employee, { 
    foreignKey: 'branchId', 
    as: 'employees' 
  });
  
  Branch.hasMany(Sale, { 
    foreignKey: 'branchId', 
    as: 'sales' 
  });

  // DailyGuideReport associations
  DailyGuideReport.belongsTo(Guide, { 
    foreignKey: 'guideId', 
    as: 'guide' 
  });

  // Barcode associations
  Barcode.belongsTo(Guide, { 
    foreignKey: 'entityId', 
    as: 'guide',
    constraints: false,
    scope: {
      type: 'GUIDE'
    }
  });
  
  Barcode.belongsTo(Employee, { 
    foreignKey: 'entityId', 
    as: 'employee',
    constraints: false,
    scope: {
      type: 'EMPLOYEE'
    }
  });

  // Sale associations with tourism models
  Sale.belongsTo(Agency, { 
    foreignKey: 'agencyId', 
    as: 'agency',
    constraints: false
  });
  
  Sale.belongsTo(Guide, { 
    foreignKey: 'guideId', 
    as: 'guide',
    constraints: false
  });
  
  Sale.belongsTo(Employee, { 
    foreignKey: 'employeeId', 
    as: 'employee',
    constraints: false
  });
  
  Sale.belongsTo(Branch, { 
    foreignKey: 'branchId', 
    as: 'branch',
    constraints: false
  });

  console.log('Model associations set up successfully');
};
