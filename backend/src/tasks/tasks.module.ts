import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskProgressService } from './task-progress.service';
import { TaskDependenciesService } from './task-dependencies.service';
import { PrismaModule } from '../database/prisma.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProjectsModule } from '../projects/projects.module';
import { AuditLogsModule } from '../audit/audit-logs.module';

@Module({
  imports: [
    PrismaModule,
    FilesModule,
    NotificationsModule,
    ProjectsModule,
    AuditLogsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskProgressService, TaskDependenciesService],
  exports: [TasksService, TaskProgressService, TaskDependenciesService],
})
export class TasksModule {}
