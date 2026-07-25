import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MppImportResultDto {
  @ApiProperty()
  tasksCreated: number;

  @ApiProperty({ description: 'Existing tasks matched by title+phase and updated' })
  tasksUpdated: number;

  @ApiProperty()
  dependenciesCreated: number;

  @ApiProperty()
  dependenciesUpdated: number;

  @ApiProperty()
  phasesCreated: number;

  @ApiProperty({ description: 'Existing phases matched by name and updated' })
  phasesUpdated: number;

  @ApiProperty()
  resourcesMatched: number;

  @ApiProperty()
  assignmentsSkipped: number;

  @ApiPropertyOptional({
    description: 'New projects created during portfolio import',
  })
  projectsCreated?: number;

  @ApiPropertyOptional({
    description: 'Existing projects matched by name during portfolio import',
  })
  projectsUpdated?: number;

  @ApiProperty({ type: [String] })
  warnings: string[];
}
