import { sequelize } from '../db/config'
import User from '../models/User'
import Client, { initializeClient } from '../models/Client'
import Product, { initializeProduct } from '../models/Product'
import Sale from '../models/Sale'
import { SaleItem, initializeSaleItem } from '../models/SaleItem'

async function ensureAdmin(): Promise<string> {
  const username = 'seed-admin'
  const email = 'seed-admin@example.com'
  let user = await User.findOne({ where: { username } })
  if (!user) {
    user = await User.create({ username, email, password: 'admin123', role: 'admin', isActive: true }) as any
  }
  return (user as any).id as string
}

function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }

async function seed() {
  await sequelize.authenticate()
  try { initializeClient(sequelize) } catch {}
  try { initializeProduct(sequelize) } catch {}
  try { initializeSaleItem(sequelize) } catch {}

  const adminId = await ensureAdmin()

  const clients: Client[] = []
  for (let i = 1; i <= 5; i++) {
    const code = `CL${String(i).padStart(3,'0')}`
    let c = await Client.findOne({ where: { code } })
    if (!c) {
      c = await Client.create({
        code,
        firstName: `Cliente${i}`,
        lastName: 'Demo',
        email: `cliente${i}@example.com`,
        isActive: true,
        totalPurchases: 0,
        loyaltyPoints: 0,
      } as any)
    }
    clients.push(c)
  }

  const products: Product[] = []
  for (let i = 1; i <= 5; i++) {
    const code = `PR${String(i).padStart(3,'0')}`
    let p = await Product.findOne({ where: { code } })
    if (!p) {
      p = await Product.create({
        code,
        name: `Producto ${i}`,
        description: 'Demo',
        category: 'General',
        material: 'Otros',
        salePrice: rand(100, 500),
        purchasePrice: rand(50, 200),
        stock: 50,
        minStock: 5,
        unit: 'pieza',
        isActive: 1,
      } as any)
    }
    products.push(p)
  }

  for (let i = 1; i <= 5; i++) {
    const client = clients[(i-1)%clients.length]
    const prod = products[(i-1)%products.length]
    const qty = rand(1, 3)
    const unitPrice = Number((prod as any).salePrice) || 100
    const subtotal = qty * unitPrice
    const discountAmount = 0
    const total = subtotal - discountAmount

    const sale = await Sale.create({
      saleNumber: Sale.generateSaleNumber(),
      clientId: (client as any).id,
      userId: adminId,
      subtotal,
      taxAmount: 0,
      discountAmount,
      total,
      paymentMethod: 'cash',
      status: 'completed',
      notes: 'Venta demo',
      saleDate: new Date(),
      saleType: 'STREET',
    } as any)

    await SaleItem.create({
      saleId: (sale as any).id,
      productId: (prod as any).id,
      quantity: qty,
      unitPrice,
      subtotal,
      discountAmount,
      total,
    } as any)

    // Actualizar métricas del cliente
    try {
      (client as any).updatePurchaseStats(total)
      await (client as any).save()
    } catch {}
  }

  console.log('✅ Seed mínimo completado: 5 clientes, 5 productos, 5 ventas')
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
