import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProgressEvidenceFileDto } from './progress-evidence-file.dto';

export class CreateProgressUpdateDto {
  @ApiProperty({
    example: 10,
    minimum: 1,
    maximum: 100,
    description:
      'Progress added in this update (increment). Stored as cumulative total = current floor + this value.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  progressPercent: number;

  @ApiProperty({ example: 8.5, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hoursSpent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Cloudinary URL/key from POST /files/upload' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  s3EvidenceKey?: string;

  @ApiPropertyOptional({
    type: [ProgressEvidenceFileDto],
    description: 'One or more evidence files from POST /files/upload',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgressEvidenceFileDto)
  evidenceFiles?: ProgressEvidenceFileDto[];
}
