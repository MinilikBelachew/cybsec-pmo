import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryTeamCandidatesDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When set, marks members already on this project and excludes its hours from other-project totals when previewing.',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
