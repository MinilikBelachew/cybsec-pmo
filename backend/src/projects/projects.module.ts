import { Module, forwardRef } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectTeamService } from './project-team.service';
import { PrismaModule } from '../database/prisma.module';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { SettingsModule } from '../settings/settings.module';
import { ResourcesModule } from '../resources/resources.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogsModule,
    SettingsModule,
    forwardRef(() => ResourcesModule),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectTeamService],
  exports: [ProjectsService, ProjectTeamService],
})
export class ProjectsModule {}
