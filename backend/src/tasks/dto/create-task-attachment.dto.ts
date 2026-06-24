import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateTaskAttachmentDto {
  @ApiProperty({
    description: 'Cloudinary public_id or secure URL returned from file upload',
    example: 'cybsec-pmo/1234567890-report.pdf',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  storageKey: string;

  @ApiProperty({ example: 'scope-document.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @ApiPropertyOptional({ example: 102400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}
