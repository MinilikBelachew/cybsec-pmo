import { ApiProperty } from '@nestjs/swagger';

export class MppImportResultDto {
  @ApiProperty()
  tasksCreated: number;

  @ApiProperty()
  dependenciesCreated: number;

  @ApiProperty()
  resourcesMatched: number;

  @ApiProperty()
  assignmentsSkipped: number;

  @ApiProperty({ type: [String] })
  warnings: string[];
}
