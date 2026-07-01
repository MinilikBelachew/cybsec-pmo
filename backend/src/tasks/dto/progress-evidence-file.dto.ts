import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ProgressEvidenceFileDto {
  @ApiProperty({ description: 'Cloudinary URL/key from POST /files/upload' })
  @IsString()
  @MaxLength(512)
  storageKey: string;

  @ApiProperty({ example: 'site-photo.jpg' })
  @IsString()
  @MaxLength(255)
  filename: string;
}
