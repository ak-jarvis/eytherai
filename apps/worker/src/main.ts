import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { logger: ['log', 'error', 'warn'] });
  const logger = app.get('WORKER_LOGGER');
  logger.log('eyther worker scaffold started with no live mailbox execution');
  await app.close();
}

void bootstrap();
