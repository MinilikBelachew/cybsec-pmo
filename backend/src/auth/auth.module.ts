import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EntraOauthService } from './entra-oauth.service';
import { AuthFailureService } from './auth-failure.service';
import { SessionActivityService } from './session-activity.service';
import { SecurityAlertService } from './security-alert.service';
import { BreakGlassService } from './break-glass.service';
import { BreakGlassRestrictionsGuard } from './guards/break-glass-restrictions.guard';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AnonymousStrategy } from './strategies/anonymous.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { SessionModule } from '../session/session.module';
import { UsersModule } from '../users/users.module';
import { AuditLogsModule } from '../audit/audit-logs.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    UsersModule,
    SessionModule,
    AuditLogsModule,
    MailModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EntraOauthService,
    AuthFailureService,
    SessionActivityService,
    SecurityAlertService,
    BreakGlassService,
    {
      provide: APP_GUARD,
      useClass: BreakGlassRestrictionsGuard,
    },
    JwtStrategy,
    JwtRefreshStrategy,
    AnonymousStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
