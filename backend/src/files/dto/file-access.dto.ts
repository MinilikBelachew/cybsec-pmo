import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FileAccessQueryDto {
  @ApiProperty({ description: 'Storage key returned from upload or attachment record' })
  @IsString()
  @MaxLength(512)
  storageKey: string;

  @ApiPropertyOptional({ description: 'Suggested download filename' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;
}

export class FileAccessResponseDto {
  @ApiProperty()
  url: string;

  @ApiProperty()
  expiresAt: string;
}
