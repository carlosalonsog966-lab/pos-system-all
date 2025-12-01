import 'dotenv/config';
import { sequelize } from '../src/db/config';
import { initializeModels } from '../src/models';
import { SaleService } from '../src/services/saleService';

async function main() {
  console.log('=== Test SaleService.getSalesStats start ===');
  try {
    await sequelize.authenticate();
    console.log('DB connected');
  } catch (e) {
    console.error('DB connect error:', (e as any)?.message);
    if ((e as any)?.stack) console.error((e as any).stack);
    return;
  }

  try {
    initializeModels();
    console.log('Models initialized');
  } catch (e) {
    console.error('Models init error:', (e as any)?.message);
    if ((e as any)?.stack) console.error((e as any).stack);
  }

  try {
    const stats = await SaleService.getSalesStats();
    console.log('Sales Stats:', JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error('Sales stats error:', (e as any)?.message);
    if ((e as any)?.stack) console.error((e as any).stack);
    if ((e as any)?.sql) console.error('SQL:', (e as any).sql);
  }

  await sequelize.close();
  console.log('=== Test SaleService.getSalesStats end ===');
}

main().catch(err => {
  console.error('Unexpected error:', err?.message);
  if (err?.stack) console.error(err.stack);
});

