import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../database/prisma.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
