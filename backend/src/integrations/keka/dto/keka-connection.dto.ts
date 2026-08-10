import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

function emptyToUndefined(value: unknown): unknown {
  if (value === null || value === '') return undefined;
  return value;
}

export class UpdateKekaConnectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MaxLength(100)
  companySubdomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sandbox?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  authUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiBaseUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Omit or leave blank to keep the existing client id.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientId?: string;

  @ApiPropertyOptional({
    description: 'Omit or leave blank to keep the existing client secret.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientSecret?: string;

  @ApiPropertyOptional({
    description: 'Omit or leave blank to keep the existing API key.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
}

export class KekaConnectionResponseDto {
  @ApiPropertyOptional({ nullable: true })
  companySubdomain: string | null;

  @ApiProperty()
  sandbox: boolean;

  @ApiPropertyOptional({ nullable: true })
  authUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  apiBaseUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  clientIdMasked: string | null;

  @ApiProperty()
  hasClientId: boolean;

  @ApiProperty()
  hasClientSecret: boolean;

  @ApiProperty()
  hasApiKey: boolean;

  @ApiProperty({ enum: ['database', 'env', 'mixed'] })
  source: 'database' | 'env' | 'mixed';

  @ApiProperty()
  configured: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastTestedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, enum: ['ok', 'failed'] })
  lastTestStatus: 'ok' | 'failed' | null;

  @ApiPropertyOptional({ nullable: true })
  lastTestError: string | null;

  @ApiPropertyOptional({ nullable: true })
  updatedAt: Date | null;

  @ApiProperty()
  effectiveAuthUrl: string;

  @ApiProperty()
  effectiveApiBaseUrl: string;
}

export class KekaConnectionTestResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  testedAt: Date;
}

/** Returned only from the explicit reveal endpoint (eye / copy). */
export class KekaConnectionSecretsDto {
  @ApiPropertyOptional({ nullable: true })
  clientId: string | null;

  @ApiPropertyOptional({ nullable: true })
  clientSecret: string | null;

  @ApiPropertyOptional({ nullable: true })
  apiKey: string | null;
}
