import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class IssueEvidenceFileDto {
  @ApiProperty({ description: 'Storage key from POST /files/upload' })
  @IsString()
  @MaxLength(512)
  storageKey: string;

  @ApiProperty({ example: 'resolution-screenshot.png' })
  @IsString()
  @MaxLength(255)
  filename: string;
}
