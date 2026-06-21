import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsBoolean, IsString } from 'class-validator';
import { RoleDto } from '../../roles/dto/role.dto';
import { lowerCaseTransformer } from '../../utils/transformers/lower-case.transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'fed-id-12345', type: String })
  @IsNotEmpty()
  @IsString()
  entraObjectId: string;

  @ApiProperty({ example: 'test1@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe', type: String })
  @IsNotEmpty()
  @IsString()
  displayName: string;

  @ApiProperty({ type: RoleDto })
  @IsNotEmpty()
  @Type(() => RoleDto)
  role: RoleDto;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  isExternal?: boolean;
}

