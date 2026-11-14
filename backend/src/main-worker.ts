import 'dotenv/config';
import dns from 'dns';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore
}

// Prisma BigInt serialization support
(BigInt.prototype as unknown as { toJSON?: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  console.log('🚀 [Worker] Bootstrapping CyberSec PMO background queue worker context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  console.log('✅ [Worker] Background worker successfully initialized. Listening for BullMQ jobs (Zero open ports).');
}

bootstrap().catch((err) => {
  console.error('❌ [Worker] Fatal error during worker startup:', err);
  process.exit(1);
});

