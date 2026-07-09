import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  DEPARTMENT_STAFFING_RULE_VALUES,
  POLICY_MODE_VALUES,
  THRESHOLD_MODE_VALUES,
} from '../app-settings.constants';

export class DesignationRuleDto {
  @ApiProperty({ example: 'Team Lead' })
  @IsString()
  projectRole: string;

  @ApiProperty({ type: [String], example: ['Team Lead', 'Security Consultant'] })
  @IsArray()
  @IsString({ each: true })
  allowedDesignations: string[];
}

export class DepartmentStaffingRulesDto {
  @ApiProperty({ enum: DEPARTMENT_STAFFING_RULE_VALUES })
  @IsIn([...DEPARTMENT_STAFFING_RULE_VALUES])
  rule: 'same_department_only' | 'allow_list';

  @ApiPropertyOptional({
    example: { GRC: ['GRC', 'SOC'], SOC: ['SOC'] },
  })
  @IsOptional()
  @IsObject()
  byProjectDepartmentCode?: Record<string, string[]>;
}

export class AllocationPoliciesDto {
  @ApiProperty({ enum: ['warn', 'block', 'approve'] })
  thresholdMode: 'warn' | 'block' | 'approve';

  @ApiProperty({ enum: POLICY_MODE_VALUES })
  designationMismatchMode: 'off' | 'warn' | 'block';

  @ApiProperty({ enum: POLICY_MODE_VALUES })
  departmentStaffingMode: 'off' | 'warn' | 'block';

  @ApiProperty({ type: [DesignationRuleDto] })
  designationRules: DesignationRuleDto[];

  @ApiProperty({ type: DepartmentStaffingRulesDto })
  departmentStaffingRules: DepartmentStaffingRulesDto;

  @ApiProperty()
  updatedAt: string;
}

export class UpdateAllocationPoliciesDto {
  @ApiPropertyOptional({ enum: THRESHOLD_MODE_VALUES })
  @IsOptional()
  @IsIn([...THRESHOLD_MODE_VALUES])
  thresholdMode?: 'warn' | 'block' | 'approve';

  @ApiPropertyOptional({ enum: POLICY_MODE_VALUES })
  @IsOptional()
  @IsIn([...POLICY_MODE_VALUES])
  designationMismatchMode?: 'off' | 'warn' | 'block';

  @ApiPropertyOptional({ enum: POLICY_MODE_VALUES })
  @IsOptional()
  @IsIn([...POLICY_MODE_VALUES])
  departmentStaffingMode?: 'off' | 'warn' | 'block';

  @ApiPropertyOptional({ type: [DesignationRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DesignationRuleDto)
  designationRules?: DesignationRuleDto[];

  @ApiPropertyOptional({ type: DepartmentStaffingRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DepartmentStaffingRulesDto)
  departmentStaffingRules?: DepartmentStaffingRulesDto;
}
