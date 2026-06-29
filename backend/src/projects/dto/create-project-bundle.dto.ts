import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';
import { CreateAllocationDto } from './create-allocation.dto';
import { CreateMilestoneDto } from './create-milestone.dto';

export class CreateProjectBundleDto extends CreateProjectDto {
  @ApiPropertyOptional({ type: [CreateAllocationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAllocationDto)
  allocations?: CreateAllocationDto[];

  @ApiPropertyOptional({ type: [CreateMilestoneDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneDto)
  milestones?: CreateMilestoneDto[];
}
