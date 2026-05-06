import { Module, Logger } from '@nestjs/common';

@Module({
  providers: [{ provide: 'WORKER_LOGGER', useValue: new Logger('EytherWorker') }]
})
export class WorkerModule {}
