import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TemplateTaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  relativeStartDays: number;

  @ApiProperty()
  durationDays: number;

  @ApiProperty()
  priority: string;

  @ApiPropertyOptional({ nullable: true })
  effortHours: number | null;

  @ApiPropertyOptional({ nullable: true })
  templatePhaseId: string | null;

  @ApiPropertyOptional({ nullable: true })
  parentId: string | null;
}

export class TemplatePhaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  orderIndex: number;

  @ApiProperty()
  relativeStartDays: number;

  @ApiProperty()
  durationDays: number;
}

export class TemplateMilestoneDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  relativeTargetDays: number;

  @ApiPropertyOptional({ nullable: true })
  weight: number | null;

  @ApiPropertyOptional({ nullable: true })
  templatePhaseId: string | null;
}

export class ProjectTemplateDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  category: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  engagementType: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  phaseCount: number;

  @ApiProperty()
  milestoneCount: number;

  @ApiProperty()
  taskCount: number;

  @ApiPropertyOptional({ type: [TemplatePhaseDto] })
  phases?: TemplatePhaseDto[];

  @ApiPropertyOptional({ type: [TemplateMilestoneDto] })
  milestones?: TemplateMilestoneDto[];

  @ApiPropertyOptional({ type: [TemplateTaskDto] })
  tasks?: TemplateTaskDto[];
}
