import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskCommentDto {
  @ApiProperty({ example: 'Please review the updated scope document.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
