import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

function trimOrUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class UpdateEntraConnectionDto {
  @ApiPropertyOptional({ description: 'Microsoft Entra ID Tenant ID (Directory ID)' })
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @MaxLength(128)
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Application (Client) ID. Omit or leave blank to keep existing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientId?: string;

  @ApiPropertyOptional({
    description: 'Client Secret Value. Omit or leave blank to keep existing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientSecret?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional custom OAuth Redirect URI. Leave blank to auto-derive.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  redirectUri?: string | null;
}

export class EntraConnectionResponseDto {
  @ApiPropertyOptional({ nullable: true })
  tenantId: string | null;

  @ApiPropertyOptional({ nullable: true })
  clientIdMasked: string | null;

  @ApiProperty()
  hasClientId: boolean;

  @ApiProperty()
  hasClientSecret: boolean;

  @ApiPropertyOptional({ nullable: true })
  redirectUri: string | null;

  @ApiProperty()
  effectiveRedirectUri: string;

  @ApiProperty({ enum: ['database', 'env', 'mixed', 'none'] })
  source: 'database' | 'env' | 'mixed' | 'none';

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
}

export class EntraConnectionTestResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  testedAt: Date;
}
