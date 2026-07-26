/**
 * Run a one-off full Keka sync (departments → employees → leave).
 *
 * Usage:
 *   cd backend && npx ts-node -r tsconfig-paths/register scripts/run-keka-sync-once.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { KekaSyncService } from '../src/integrations/keka/sync/keka-sync.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const kekaSyncService = app.get(KekaSyncService);
    const result = await kekaSyncService.syncAllNow();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
