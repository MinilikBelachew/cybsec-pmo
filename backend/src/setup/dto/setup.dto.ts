import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  EntraConnectionResponseDto,
  UpdateEntraConnectionDto,
} from '../../auth/dto/entra-connection.dto';
import { MailConnectionResponseDto } from '../../mailer/dto/mail-connection.dto';
import { KekaConnectionResponseDto } from '../../integrations/keka/dto/keka-connection.dto';

function trimOrUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class SetupStatusResponseDto {
  @ApiProperty()
  setupCompleted: boolean;

  @ApiProperty()
  setupRequired: boolean;

  @ApiProperty({
    description:
      'True when initial setup is incomplete AND Entra ID is not yet configured (safe auto-redirect trigger for /login).',
  })
  redirectToSetup: boolean;

  @ApiProperty()
  entraConfigured: boolean;

  @ApiProperty()
  mailConfigured: boolean;

  @ApiProperty()
  kekaConfigured: boolean;

  @ApiProperty()
  hasSuperAdmin: boolean;

  @ApiPropertyOptional({ nullable: true })
  setupCompletedAt: Date | null;
}

export class UnlockSetupDto {
  @ApiProperty({ description: 'Static setup key from server environment (.env)' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  setupKey: string;
}

export class UnlockSetupResponseDto {
  @ApiProperty()
  setupToken: string;

  @ApiProperty()
  expiresInSeconds: number;
}

export class SaveSetupEntraDto extends UpdateEntraConnectionDto {
  @ApiPropertyOptional({
    description:
      'Corporate Microsoft email address of the first Super Admin user.',
  })
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsEmail()
  @MaxLength(255)
  superAdminEmail?: string;

  @ApiPropertyOptional({
    description: 'Display name of the first Super Admin user.',
  })
  @IsOptional()
  @Transform(({ value }) => trimOrUndefined(value))
  @IsString()
  @MaxLength(255)
  superAdminName?: string;
}

export class SetupSuperAdminSummaryDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  displayName: string;
}

export class SetupConfigResponseDto {
  @ApiProperty({ type: EntraConnectionResponseDto })
  entra: EntraConnectionResponseDto;

  @ApiProperty({ type: MailConnectionResponseDto })
  mail: MailConnectionResponseDto;

  @ApiProperty({ type: KekaConnectionResponseDto })
  keka: KekaConnectionResponseDto;

  @ApiPropertyOptional({ type: SetupSuperAdminSummaryDto, nullable: true })
  superAdmin: SetupSuperAdminSummaryDto | null;
}
