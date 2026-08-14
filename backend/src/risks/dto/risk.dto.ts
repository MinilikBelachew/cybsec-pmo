import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RiskOwnerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;
}

export class RiskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  projectName?: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  impact: number;

  @ApiProperty()
  likelihood: number;

  @ApiProperty({ description: 'Auto-calculated as impact × likelihood' })
  score: number;

  @ApiProperty()
  ownerId: string;

  @ApiPropertyOptional({ type: RiskOwnerDto })
  owner?: RiskOwnerDto;

  @ApiPropertyOptional({ nullable: true })
  mitigationPlan: string | null;

  @ApiPropertyOptional({ nullable: true })
  targetDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  residualImpact: number | null;

  @ApiPropertyOptional({ nullable: true })
  residualLikelihood: number | null;

  @ApiPropertyOptional({ nullable: true })
  residualRating: number | null;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  closedAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({
    description: 'True when score meets or exceeds the high threshold (default 12)',
  })
  isHigh: boolean;
}
