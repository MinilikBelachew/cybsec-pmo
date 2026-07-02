import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectTeamService } from './project-team.service';
import { PrismaModule } from '../database/prisma.module';
import { AuditLogsModule } from '../audit/audit-logs.module';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectTeamService],
  exports: [ProjectsService, ProjectTeamService],
})
export class ProjectsModule {}
