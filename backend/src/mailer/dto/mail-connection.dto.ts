import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function trimOrUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class UpdateMailConnectionDto {
  @ApiPropertyOptional({ description: 'Use SendGrid as primary email provider' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  sendgridEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'SendGrid API key. Omit or leave blank to keep existing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sendgridApiKey?: string;

  @ApiPropertyOptional({ description: 'SMTP host (e.g. smtp.gmail.com)' })
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @MaxLength(255)
  smtpHost?: string;

  @ApiPropertyOptional({ description: 'SMTP port (e.g. 587 or 465)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @ApiPropertyOptional({ description: 'SMTP username / email' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUser?: string;

  @ApiPropertyOptional({
    description: 'SMTP password / App Password. Omit or leave blank to keep existing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  smtpPassword?: string;

  @ApiPropertyOptional({ description: 'Use implicit TLS/SSL (usually port 465)' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiPropertyOptional({ description: 'Ignore TLS' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  smtpIgnoreTls?: boolean;

  @ApiPropertyOptional({ description: 'Require STARTTLS (usually port 587)' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  smtpRequireTls?: boolean;

  @ApiPropertyOptional({ description: 'Default From email address' })
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsEmail()
  @MaxLength(255)
  defaultEmail?: string;

  @ApiPropertyOptional({ description: 'Default From display name' })
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @MaxLength(255)
  defaultName?: string;
}

export class TestMailConnectionDto extends UpdateMailConnectionDto {
  @ApiProperty({ description: 'Recipient email address for the test email' })
  @IsEmail()
  testEmail: string;
}

export class MailConnectionResponseDto {
  @ApiProperty()
  sendgridEnabled: boolean;

  @ApiPropertyOptional({ nullable: true })
  sendgridApiKeyMasked: string | null;

  @ApiProperty()
  hasSendgridApiKey: boolean;

  @ApiPropertyOptional({ nullable: true })
  smtpHost: string | null;

  @ApiProperty()
  smtpPort: number;

  @ApiPropertyOptional({ nullable: true })
  smtpUser: string | null;

  @ApiProperty()
  hasSmtpPassword: boolean;

  @ApiProperty()
  smtpSecure: boolean;

  @ApiProperty()
  smtpIgnoreTls: boolean;

  @ApiProperty()
  smtpRequireTls: boolean;

  @ApiPropertyOptional({ nullable: true })
  defaultEmail: string | null;

  @ApiPropertyOptional({ nullable: true })
  defaultName: string | null;

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

export class MailConnectionTestResultDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ enum: ['sendgrid', 'smtp'] })
  provider: 'sendgrid' | 'smtp';

  @ApiProperty()
  message: string;

  @ApiProperty()
  testedAt: Date;
}
