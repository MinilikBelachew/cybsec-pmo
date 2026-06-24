import { AppConfig } from './app-config.type';
import { AuthConfig } from '../auth/config/auth-config.type';
import { DatabaseConfig } from '../database/config/database-config.type';
import { MailConfig } from '../mail/config/mail-config.type';
import { FileConfig } from '../files/config/file-config.type';
import { RedisConfig } from './redis-config.type';
import { LoginSecurityConfig } from '../auth/config/login-security.config';

export type AllConfigType = {
  app: AppConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  mail: MailConfig;
  file: FileConfig;
  redis: RedisConfig;
  loginSecurity: LoginSecurityConfig;
};




