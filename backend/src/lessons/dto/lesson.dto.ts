import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const LESSON_CATEGORIES = [
  'DEPLOYMENT',
  'SECURITY',
  'PROCESS',
  'COMMUNICATION',
  'TECHNICAL',
  'OTHER',
] as const;

export type LessonCategory = (typeof LESSON_CATEGORIES)[number];

export class CreateLessonDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ enum: LESSON_CATEGORIES, example: 'DEPLOYMENT' })
  @IsString()
  @IsNotEmpty()
  @IsIn(LESSON_CATEGORIES)
  category: LessonCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  recommendation: string;

  @ApiPropertyOptional({ type: [String], example: ['docker', 'networking'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateLessonDto {
  @ApiPropertyOptional({ enum: LESSON_CATEGORIES })
  @IsOptional()
  @IsString()
  @IsIn(LESSON_CATEGORIES)
  category?: LessonCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendation?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class LessonAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  email: string;
}

export class LessonDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  projectId: string | null;

  @ApiPropertyOptional()
  projectName?: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  recommendation: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  authorId: string;

  @ApiPropertyOptional({ type: LessonAuthorDto })
  author?: LessonAuthorDto;

  @ApiProperty()
  createdAt: string;
}
