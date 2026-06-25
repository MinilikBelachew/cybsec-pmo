import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Requirements Signed Off', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: '2026-01-15' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  targetDate: Date;

  @ApiPropertyOptional({ example: 10.0, description: 'Milestone weight/percentage contribution (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ example: 'Pending', default: 'Pending' })
  @IsString()
  @IsOptional()
  status?: string = 'Pending';

  @ApiPropertyOptional({ format: 'uuid', description: 'Associated phase ID' })
  @IsUUID()
  @IsOptional()
  phaseId?: string;
}
