import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const LOGOUT_REASON_IDLE = 'idle_timeout';
export const LOGOUT_REASON_USER = 'user';

export class LogoutDto {
  @ApiPropertyOptional({
    enum: [LOGOUT_REASON_USER, LOGOUT_REASON_IDLE],
    description:
      'idle_timeout = automatic session timeout (DEF-P1-072). Omit or user = clicked Logout.',
  })
  @IsOptional()
  @IsIn([LOGOUT_REASON_USER, LOGOUT_REASON_IDLE])
  reason?: typeof LOGOUT_REASON_USER | typeof LOGOUT_REASON_IDLE;
}
