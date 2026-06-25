import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RoleDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsInt()
  id: number;

  @ApiPropertyOptional({ example: 'super_admin' })
  @IsOptional()
  @IsString()
  code?: string;
}
