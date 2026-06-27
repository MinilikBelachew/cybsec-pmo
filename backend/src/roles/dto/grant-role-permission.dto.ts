import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { RECORD_SCOPE_CODES } from '../../casl/record-scope.registry';

export class GrantRolePermissionDto {
  @ApiPropertyOptional({ description: 'Catalog permission id' })
  @IsOptional()
  @IsUUID()
  permissionId?: string;

  @ApiPropertyOptional({ example: 'tasks' })
  @ValidateIf((dto: GrantRolePermissionDto) => !dto.permissionId)
  @IsString()
  module?: string;

  @ApiPropertyOptional({ example: 'edit' })
  @ValidateIf((dto: GrantRolePermissionDto) => !dto.permissionId)
  @IsString()
  action?: string;

  @ApiProperty({ enum: [...RECORD_SCOPE_CODES] })
  @IsString()
  @IsIn([...RECORD_SCOPE_CODES])
  recordScope: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  fieldScope?: Record<string, unknown> | null;
}
