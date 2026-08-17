import { registerAs } from '@nestjs/config';
import { IsInt, IsOptional, IsUrl, Max, Min } from 'class-validator';
import validateConfig from '../../utils/validate-config';
import { FxConfig } from './fx-config.type';

class EnvironmentVariablesValidator {
  @IsUrl({ require_tld: false })
  @IsOptional()
  FX_API_URL: string;

  @IsInt()
  @Min(0)
  @Max(86_400_000)
  @IsOptional()
  FX_CACHE_TTL_MS: number;

  @IsInt()
  @Min(1000)
  @Max(60_000)
  @IsOptional()
  FX_TIMEOUT_MS: number;
}

export default registerAs<FxConfig>('fx', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    apiUrl: process.env.FX_API_URL ?? 'https://open.er-api.com/v6/latest/USD',
    cacheTtlMs: Number(process.env.FX_CACHE_TTL_MS ?? 3_600_000),
    timeoutMs: Number(process.env.FX_TIMEOUT_MS ?? 8_000),
  };
});
