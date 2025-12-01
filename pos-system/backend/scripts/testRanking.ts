import 'dotenv/config';
import { sequelize } from '../src/db/config';
import { RankingService } from '../src/services/rankingService';

async function main() {
  console.log('=== Test RankingService start ===');
  try {
    await sequelize.authenticate();
    console.log('DB connected');
  } catch (e) {
    console.error('DB connect error:', (e as any)?.message);
    if ((e as any)?.stack) console.error((e as any).stack);
    return;
  }

  try {
    const weekly = await RankingService.getWeeklyRankings({});
    console.log('Weekly OK:', JSON.stringify(weekly, null, 2));
  } catch (e) {
    console.error('Weekly error:', (e as any)?.message);
    if ((e as any)?.stack) console.error((e as any).stack);
    if ((e as any)?.sql) console.error('SQL:', (e as any).sql);
  }

  try {
    const perf = await RankingService.getProductPerformance({});
    console.log('Product performance OK:', JSON.stringify(perf, null, 2));
  } catch (e) {
    console.error('Product performance error:', (e as any)?.message);
    if ((e as any)?.stack) console.error((e as any).stack);
    if ((e as any)?.sql) console.error('SQL:', (e as any).sql);
  }

  await sequelize.close();
  console.log('=== Test RankingService end ===');
}

main().catch(err => {
  console.error('Unexpected error:', err?.message);
  if (err?.stack) console.error(err.stack);
});

