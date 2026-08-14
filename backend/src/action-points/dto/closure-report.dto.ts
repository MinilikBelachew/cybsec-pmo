import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActionPointClosureReportRowDto {
  @ApiProperty()
  sourceType: string;

  @ApiProperty()
  ownerId: string;

  @ApiPropertyOptional()
  ownerName?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  count: number;
}

export class ActionPointClosureReportDto {
  @ApiProperty({ type: [ActionPointClosureReportRowDto] })
  bySource: ActionPointClosureReportRowDto[];

  @ApiProperty({ type: [ActionPointClosureReportRowDto] })
  byOwner: ActionPointClosureReportRowDto[];

  @ApiProperty({ type: [ActionPointClosureReportRowDto] })
  byStatus: ActionPointClosureReportRowDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  closed: number;

  @ApiProperty()
  overdueOpen: number;
}
