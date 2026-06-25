import { registerAs } from '@nestjs/config';
import { IsEmail, IsOptional } from 'class-validator';
import validateConfig from '../../utils/validate-config';

export type SecurityAlertsConfig = {
  enabled: boolean;
  alertEmail: string;
};

class EnvironmentVariablesValidator {
  @IsEmail()
  @IsOptional()
  SECURITY_ALERT_EMAIL: string;
}

export default registerAs<SecurityAlertsConfig>('securityAlerts', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    enabled: process.env.SECURITY_ALERTS_ENABLED !== 'false',
    alertEmail:
      process.env.SECURITY_ALERT_EMAIL ?? 'bminilik12@gmail.com',
  };
});
