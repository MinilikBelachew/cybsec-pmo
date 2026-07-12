import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActionPointOwnerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;
}

export class ActionPointDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  sourceType: string;

  @ApiProperty()
  sourceId: string;

  @ApiPropertyOptional({ nullable: true })
  projectId: string | null;

  @ApiProperty()
  ownerId: string;

  @ApiPropertyOptional({ type: ActionPointOwnerDto })
  owner?: ActionPointOwnerDto;

  @ApiProperty()
  dueDate: string;

  @ApiProperty()
  priority: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ nullable: true })
  closureNote: string | null;

  @ApiPropertyOptional({ nullable: true })
  closedAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({
    description: 'True when due date is before today and status is not Done/Cancelled',
  })
  isOverdue: boolean;
}
