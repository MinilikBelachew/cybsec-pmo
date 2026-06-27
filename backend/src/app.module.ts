import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './database/config/database.config';
import authConfig from './auth/config/auth.config';
import appConfig from './config/app.config';
import mailConfig from './mail/config/mail.config';
import fileConfig from './files/config/file.config';
import redisConfig from './config/redis.config';
import path from 'path';
import fs from 'fs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { AllConfigType } from './config/config.type';
import { SessionModule } from './session/session.module';
import { MailerModule } from './mailer/mailer.module';
import { FilesModule } from './files/files.module';
import { BullModule } from '@nestjs/bull';
import loginSecurityConfig from './auth/config/login-security.config';
import sessionSecurityConfig from './auth/config/session-security.config';
import securityAlertsConfig from './auth/config/security-alerts.config';
import breakGlassConfig from './auth/config/break-glass.config';
import { RedisModule } from './redis/redis.module';
import { AuditLogsModule } from './audit/audit-logs.module';
import { CaslModule } from './casl/casl.module';
import { RolesModule } from './roles/roles.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DashboardModule } from './dashboard/dashboard.module';
import { CurrenciesModule } from './currencies/currencies.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        redisConfig,
        loginSecurityConfig,
        sessionSecurityConfig,
        securityAlertsConfig,
        breakGlassConfig,
      ],
      envFilePath: ['.env'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        redis: {
          host: configService.getOrThrow('redis.host', { infer: true }),
          port: configService.getOrThrow('redis.port', { infer: true }),
          password: configService.get('redis.password', { infer: true }),
        },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    PrismaModule,
    CaslModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => {
        let i18nPath = path.join(__dirname, '/i18n/');
        if (!fs.existsSync(i18nPath)) {
          i18nPath = path.join(__dirname, '../i18n/');
        }
        return {
          fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
            infer: true,
          }),
          loaderOptions: { path: i18nPath, watch: true },
        };
      },

      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
    ProjectsModule,
    TasksModule,
    FilesModule,
    AuditLogsModule,
    RolesModule,
    SettingsModule,
    NotificationsModule,
    DashboardModule,
    CurrenciesModule,
    ScheduleModule.forRoot(),
  ],
})
export class AppModule {}


