import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;
}

export class IssueDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  projectName?: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  ownerId: string;

  @ApiPropertyOptional({ type: IssueUserDto })
  owner?: IssueUserDto;

  @ApiProperty()
  dueDate: string;

  @ApiPropertyOptional({ nullable: true })
  expectedResolutionDate: string | null;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  resolutionNote: string | null;

  @ApiPropertyOptional({ nullable: true })
  s3EvidenceKey: string | null;

  @ApiProperty()
  raisedBy: string;

  @ApiPropertyOptional({ type: IssueUserDto })
  raiser?: IssueUserDto;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({
    description:
      'True when due/expected resolution is before today and status is open',
  })
  isOverdue: boolean;

  @ApiProperty({
    description: 'True when priority is High/Critical or issue is overdue',
  })
  requiresEscalation: boolean;
}
