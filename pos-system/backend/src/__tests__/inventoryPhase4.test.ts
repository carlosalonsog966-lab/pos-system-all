import request from 'supertest'
import jwt from 'jsonwebtoken'
import app, { initializeDatabase } from '../app'
import { sequelize } from '../db/config'
import { User } from '../models/User'
import Product from '../models/Product'
import StockLedger from '../models/StockLedger'

function makeToken(userId: string) {
  const secret = process.env.JWT_SECRET || 'default-secret-key'
  const payload: any = { userId, username: 'admin', role: 'admin' }
  return jwt.sign(payload, secret, { expiresIn: '1h' })
}

describe('Phase 4 Inventario y Movimientos', () => {
  let token: string
  let productId: string

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    await initializeDatabase()
    const user = await User.create({ username: 'admin', email: 'admin@test', password: 'x', role: 'admin', isActive: true } as any)
    token = makeToken(user.id as any)
    const p = await Product.create({ code: 'P001', name: 'Pieza 1', category: 'Otros', material: 'Oro', purchasePrice: 100, salePrice: 200, stock: 10, minStock: 1, isActive: true, isUniquePiece: false, warrantyMonths: 0, version: 1 } as any)
    productId = p.id
  })

  afterAll(async () => {
    try { await sequelize.close() } catch {}
  })

  test('Conteo cíclico crea y aplica ajuste', async () => {
    const createRes = await request(app).post('/api/inventory/cycle-counts').set('Authorization', `Bearer ${token}`).send({ type: 'general' })
    expect(createRes.status).toBe(200)
    const id = createRes.body.data.id || createRes.body.data.data?.id
    expect(id).toBeTruthy()
    const startRes = await request(app).post(`/api/inventory/cycle-counts/${id}/start`).set('Authorization', `Bearer ${token}`).send({})
    expect(startRes.status).toBe(200)
    const preloadRes = await request(app).post(`/api/inventory/cycle-counts/${id}/preload`).set('Authorization', `Bearer ${token}`).send({})
    expect(preloadRes.status).toBe(200)
    const listRes = await request(app).get(`/api/inventory/cycle-counts/${id}`).set('Authorization', `Bearer ${token}`)
    expect(listRes.status).toBe(200)
    const item = (listRes.body.data.items || []).find((i: any) => i.productId === productId)
    expect(item).toBeTruthy()
    const newCount = item.expectedQty + 1
    const setRes = await request(app).post(`/api/inventory/cycle-counts/${id}/items/${item.id}/count`).set('Authorization', `Bearer ${token}`).send({ countedQty: newCount })
    expect(setRes.status).toBe(200)
    const applyRes = await request(app).post(`/api/inventory/cycle-counts/${id}/apply-adjustments`).set('Authorization', `Bearer ${token}`).send({})
    expect(applyRes.status).toBe(200)
    const pAfter = await Product.findByPk(productId)
    expect(pAfter?.stock).toBe(11)
  })

  test('Transferencia request, ship, receive', async () => {
    const reqRes = await request(app).post('/api/inventory/transfers/request').set('Authorization', `Bearer ${token}`).send({ productId, quantity: 2, fromBranchId: '11111111-1111-1111-1111-111111111111', toBranchId: '22222222-2222-2222-2222-222222222222' })
    expect(reqRes.status).toBe(200)
    const tid = reqRes.body.data.id
    expect(tid).toBeTruthy()
    const shipRes = await request(app).post(`/api/inventory/transfers/${tid}/ship`).set('Authorization', `Bearer ${token}`).send({})
    expect(shipRes.status).toBe(200)
    const pMid = await Product.findByPk(productId)
    expect(pMid?.stock).toBe(9)
    const recvRes = await request(app).post(`/api/inventory/transfers/${tid}/receive`).set('Authorization', `Bearer ${token}`).send({})
    expect(recvRes.status).toBe(200)
    const pEnd = await Product.findByPk(productId)
    expect(pEnd?.stock).toBe(11)
    const ledgerCount = await StockLedger.count({ where: { referenceType: 'TRANSFER', referenceId: tid } as any })
    expect(ledgerCount).toBe(2)
  })
})
