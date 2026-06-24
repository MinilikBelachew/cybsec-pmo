import { registerAs } from '@nestjs/config';
import { IsInt, Min, IsOptional } from 'class-validator';
import validateConfig from '../../utils/validate-config';

export type LoginSecurityConfig = {
  maxFailures: number;
  failureWindowSec: number;
  lockoutSec: number;
  rateLimitPerIp: number;
  rateLimitWindowSec: number;
  alertThreshold: number;
};

class EnvironmentVariablesValidator {
  @IsInt()
  @Min(1)
  @IsOptional()
  AUTH_LOGIN_MAX_FAILURES: number;

  @IsInt()
  @Min(60)
  @IsOptional()
  AUTH_LOGIN_FAILURE_WINDOW_SEC: number;

  @IsInt()
  @Min(60)
  @IsOptional()
  AUTH_LOGIN_LOCKOUT_SEC: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  AUTH_LOGIN_RATE_LIMIT: number;

  @IsInt()
  @Min(10)
  @IsOptional()
  AUTH_LOGIN_RATE_WINDOW_SEC: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  AUTH_LOGIN_ALERT_THRESHOLD: number;
}

export default registerAs<LoginSecurityConfig>('loginSecurity', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    maxFailures: parseInt(process.env.AUTH_LOGIN_MAX_FAILURES ?? '5', 10),
    failureWindowSec: parseInt(
      process.env.AUTH_LOGIN_FAILURE_WINDOW_SEC ?? '900',
      10,
    ),
    lockoutSec: parseInt(process.env.AUTH_LOGIN_LOCKOUT_SEC ?? '1800', 10),
    rateLimitPerIp: parseInt(process.env.AUTH_LOGIN_RATE_LIMIT ?? '10', 10),
    rateLimitWindowSec: parseInt(
      process.env.AUTH_LOGIN_RATE_WINDOW_SEC ?? '60',
      10,
    ),
    alertThreshold: parseInt(
      process.env.AUTH_LOGIN_ALERT_THRESHOLD ?? '5',
      10,
    ),
  };
});
