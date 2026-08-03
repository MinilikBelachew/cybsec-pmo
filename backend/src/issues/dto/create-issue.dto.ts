import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPriorityLevel } from '../../projects/enums/project-api.enum';

export class CreateIssueDto {
  @ApiProperty({ example: 'Snyk scan failures' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ enum: ApiPriorityLevel, example: ApiPriorityLevel.High })
  @IsEnum(ApiPriorityLevel)
  priority: ApiPriorityLevel;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ownerId: string;

  @ApiProperty({ example: '2026-08-20' })
  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  @ApiPropertyOptional({ example: '2026-08-25' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expectedResolutionDate?: Date;

  @ApiPropertyOptional({ example: 'Open', default: 'Open' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string = 'Open';
}
