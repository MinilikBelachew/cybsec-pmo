import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class RejectAllocationApprovalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}

export class AllocationApprovalRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  designation: string;

  @ApiProperty()
  department: string;

  @ApiProperty()
  role: string;

  @ApiPropertyOptional({ nullable: true })
  hours: number | null;

  @ApiPropertyOptional({ nullable: true })
  percent: number | null;

  @ApiProperty()
  startDate: string;

  @ApiPropertyOptional({ nullable: true })
  endDate: string | null;

  @ApiProperty()
  weeklyCapacityHours: number;

  @ApiProperty()
  allocatedHoursAfter: number;

  @ApiProperty()
  utilizationPercent: number;

  @ApiProperty()
  requestedBy: { id: string; name: string };

  @ApiProperty()
  requestedAt: string;
}

export class AllocationApprovalListResponseDto {
  @ApiProperty({ type: [AllocationApprovalRowDto] })
  rows: AllocationApprovalRowDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;
}

export class QueryAllocationApprovalsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['requestedAt', 'employeeName', 'projectName'] })
  @IsOptional()
  @IsIn(['requestedAt', 'employeeName', 'projectName'])
  sortBy?: 'requestedAt' | 'employeeName' | 'projectName';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AllocationApprovalDecisionDto {
  @ApiProperty({ type: AllocationApprovalRowDto })
  allocation: AllocationApprovalRowDto;

  @ApiPropertyOptional()
  kekaSyncRef?: string | null;
}
