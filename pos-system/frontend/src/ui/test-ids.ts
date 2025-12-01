export const TEST_IDS = {
  ventas: {
    addItem: 'ventas.add-item',
    selectCustomer: 'ventas.select-customer',
    payment: 'ventas.payment',
    save: 'ventas.save',
    printTicket: 'ventas.print-ticket',
    cartCount: 'ventas.cart-count',
  },
  caja: {
    openSession: 'caja.open-session',
    cashIn: 'caja.cash-in',
    cashOut: 'caja.cash-out',
    closeSession: 'caja.close-session',
    status: 'caja.status',
  },
  joyas: {
    create: 'joyas.create',
    save: 'joyas.save',
    qrGenerate: 'joyas.qr-generate',
  },
  inventario: {
    adjust: 'inventario.adjust',
    transfer: 'inventario.transfer',
    history: 'inventario.history',
  },
  clientes: {
    create: 'clientes.create',
    save: 'clientes.save',
  },
  usuarios: {
    create: 'usuarios.create',
    assignRole: 'usuarios.assign-role',
    disable: 'usuarios.disable',
  },
  reportes: {
    dailyExportPdf: 'reportes.daily.export-pdf',
    monthlyExportCsv: 'reportes.monthly.export-csv',
  },
  config: {
    taxUpdate: 'config.tax.update',
    currencyUpdate: 'config.currency.update',
    save: 'config.save',
  },
  respaldos: {
    backupNow: 'respaldos.backup.now',
    restoreTest: 'respaldos.restore.test',
    last: 'respaldos.last',
  },
  observabilidad: {
    sentryTest: 'observabilidad.sentry.test',
    otelTest: 'observabilidad.otel.test',
    logsView: 'observabilidad.logs.view',
  },
  salud: {
    ping: 'salud.ping',
    db: 'salud.db',
  },
  jobs: {
    run: 'jobs.run',
    status: 'jobs.status',
  },
  ui: {
    toast: 'ui.toast',
    loader: 'ui.loader',
    confirm: 'ui.confirm',
  },
} as const

