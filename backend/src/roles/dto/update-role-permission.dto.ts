import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { RECORD_SCOPE_CODES } from '../../casl/record-scope.registry';

export class UpdateRolePermissionDto {
  @ApiPropertyOptional({ enum: [...RECORD_SCOPE_CODES] })
  @IsOptional()
  @IsString()
  @IsIn([...RECORD_SCOPE_CODES])
  recordScope?: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  fieldScope?: Record<string, unknown> | null;
}
