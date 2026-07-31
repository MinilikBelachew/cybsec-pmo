import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateBrandingProfileDto {
  @ApiProperty({ example: 'CyberSec Default' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'CyberSec' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  companyName: string;

  @ApiProperty({ example: 'CyberSec PMO' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  documentOwner: string;

  @ApiPropertyOptional({ example: '#0B3D5C' })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#C45C26' })
  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @ApiPropertyOptional({ example: '#5A6A75' })
  @IsOptional()
  @IsHexColor()
  mutedColor?: string;

  @ApiPropertyOptional({ example: '#D7DEE5' })
  @IsOptional()
  @IsHexColor()
  lineColor?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateBrandingProfileDto extends PartialType(
  CreateBrandingProfileDto,
) {}

export class BrandingProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  documentOwner: string;

  @ApiProperty({ nullable: true })
  logoFileName: string | null;

  @ApiProperty({ nullable: true })
  logoMimeType: string | null;

  @ApiProperty({ description: 'True when a logo has been uploaded' })
  hasLogo: boolean;

  @ApiProperty()
  primaryColor: string;

  @ApiProperty()
  accentColor: string;

  @ApiProperty()
  mutedColor: string;

  @ApiProperty()
  lineColor: string;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty({
    description:
      'Projects issued under this brand. They fall back to the default profile if it is deleted.',
  })
  projectCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/** Lightweight option for the project form picker. */
export class BrandingProfileOptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  companyName: string;

  @ApiProperty()
  isDefault: boolean;
}
