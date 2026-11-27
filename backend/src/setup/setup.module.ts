import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MailerModule } from '../mailer/mailer.module';
import { SetupController } from './setup.controller';
import { ConnectionSettingsController } from './connection-settings.controller';
import { SetupService } from './setup.service';
import { SetupTokenGuard } from './guards/setup-token.guard';

@Module({
  imports: [PrismaModule, AuthModule, MailerModule, JwtModule.register({})],
  controllers: [SetupController, ConnectionSettingsController],
  providers: [SetupService, SetupTokenGuard],
  exports: [SetupService],
})
export class SetupModule {}
