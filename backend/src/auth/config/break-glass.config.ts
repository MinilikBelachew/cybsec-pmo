import { registerAs } from '@nestjs/config';
import { IsOptional, IsString, MinLength } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import ms from 'ms';

export type BreakGlassConfig = {
  enabled: boolean;
  ttl: ms.StringValue;
  emergencySecret: string;
};

class EnvironmentVariablesValidator {
  @IsString()
  @MinLength(16)
  @IsOptional()
  BREAK_GLASS_EMERGENCY_SECRET: string;
}

export default registerAs<BreakGlassConfig>('breakGlass', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    enabled: process.env.BREAK_GLASS_ENABLED !== 'false',
    ttl: (process.env.AUTH_BREAK_GLASS_TTL ?? '4h') as ms.StringValue,
    emergencySecret:
      process.env.BREAK_GLASS_EMERGENCY_SECRET ?? 'change-me-in-production',
  };
});
