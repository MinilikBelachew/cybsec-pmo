import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { SESSION_SECURITY_LIMITS } from '../app-settings.constants';

export class SessionSecuritySettingsDto {
  @ApiProperty({ example: 900, description: 'Idle timeout in seconds' })
  idleTimeoutSec: number;

  @ApiProperty({
    example: 300,
    description: 'Seconds before idle timeout to show the warning',
  })
  warningBeforeSec: number;

  @ApiProperty()
  updatedAt: string;
}

export class UpdateSessionSecuritySettingsDto {
  @ApiPropertyOptional({
    minimum: SESSION_SECURITY_LIMITS.idleTimeoutSec.min,
    maximum: SESSION_SECURITY_LIMITS.idleTimeoutSec.max,
  })
  @IsOptional()
  @IsInt()
  @Min(SESSION_SECURITY_LIMITS.idleTimeoutSec.min)
  @Max(SESSION_SECURITY_LIMITS.idleTimeoutSec.max)
  idleTimeoutSec?: number;

  @ApiPropertyOptional({
    minimum: SESSION_SECURITY_LIMITS.warningBeforeSec.min,
    maximum: SESSION_SECURITY_LIMITS.warningBeforeSec.max,
  })
  @IsOptional()
  @IsInt()
  @Min(SESSION_SECURITY_LIMITS.warningBeforeSec.min)
  @Max(SESSION_SECURITY_LIMITS.warningBeforeSec.max)
  warningBeforeSec?: number;
}
