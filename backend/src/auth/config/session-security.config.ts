import { registerAs } from '@nestjs/config';
import { IsInt, Min, IsOptional } from 'class-validator';
import validateConfig from '../../utils/validate-config';

export type SessionSecurityConfig = {
  idleTimeoutSec: number;
  warningBeforeSec: number;
};

class EnvironmentVariablesValidator {
  @IsInt()
  @Min(30)
  @IsOptional()
  AUTH_SESSION_IDLE_SEC: number;

  @IsInt()
  @Min(10)
  @IsOptional()
  AUTH_SESSION_WARNING_BEFORE_SEC: number;
}

export default registerAs<SessionSecurityConfig>('sessionSecurity', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    idleTimeoutSec: parseInt(process.env.AUTH_SESSION_IDLE_SEC ?? '900', 10),
    warningBeforeSec: parseInt(
      process.env.AUTH_SESSION_WARNING_BEFORE_SEC ?? '300',
      10,
    ),
  };
});
