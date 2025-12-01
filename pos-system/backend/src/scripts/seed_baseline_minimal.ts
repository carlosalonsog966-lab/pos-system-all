import { sequelize } from '../db/config'
import Branch from '../models/Branch'
import Agency from '../models/Agency'
import Guide from '../models/Guide'
import Client from '../models/Client'
import Product from '../models/Product'
import Sale from '../models/Sale'
import { initializeSaleItem } from '../models/SaleItem'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const _sequelize = require('../db/config').sequelize

async function run() {
  await sequelize.authenticate()
  try { initializeSaleItem(_sequelize) } catch {}
  const [branch] = await Branch.findOrCreate({ where: { code: 'MAIN' }, defaults: { name: 'Sucursal Principal', address: 'Centro', phone: '000', manager: 'Admin', isActive: true } })
  const [agency] = await Agency.findOrCreate({ where: { name: 'Agencia Demo' }, defaults: { location: 'Centro', phone: '000', email: 'agencia@demo.com', manager: 'Admin', status: 'active' } as any })
  const [guide] = await Guide.findOrCreate({ where: { name: 'Guía Demo' }, defaults: { agencyId: String((agency as any).id), phone: '000', email: 'guia@demo.com', status: 'active' } as any })
  const [client] = await Client.findOrCreate({ where: { email: 'cliente@demo.com' }, defaults: { firstName: 'Cliente', lastName: 'Demo', phone: '000', isActive: true } as any })
  let product = await Product.findOne()
  if (!product) {
    product = await Product.create({
      code: 'PRD-001',
      name: 'Producto Demo',
      description: 'Demo',
      category: 'General',
      material: 'Otros',
      salePrice: 100,
      purchasePrice: 50,
      stock: 10,
      minStock: 1,
      unit: 'pieza',
      isActive: 1,
    } as any)
  }
  const sale = await Sale.create({
    branchId: String((branch as any).id),
    clientId: String((client as any).id),
    totalAmount: Number((product as any).salePrice) || 100,
    paymentMethod: 'cash',
    status: 'completed',
  } as any)
  await SaleItem.create({
    saleId: String((sale as any).id),
    productId: String((product as any).id),
    quantity: 1,
    unitPrice: Number((product as any).salePrice) || 100,
    totalPrice: Number((product as any).salePrice) || 100,
  } as any)
  await sequelize.close()
}

run().then(() => { process.exit(0) }).catch((e) => { console.error(e); process.exit(1) })
