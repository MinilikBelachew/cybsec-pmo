import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import crypto from 'crypto';
import { AllConfigType } from '../config/config.type';
import { PrismaService } from '../database/prisma.service';
import { EntraConnectionService } from '../auth/entra-connection.service';
import { MailConnectionService } from '../mailer/mail-connection.service';
import { KekaConnectionService } from '../integrations/keka/keka-connection.service';
import { ROLE_ID_BY_CODE } from '../roles/role-catalog';
import {
  DEFAULT_HEALTH_RULES,
  HEALTH_RULE_VERSION,
} from '../reports/health/health-rules.constants';
import {
  EntraConnectionResponseDto,
  EntraConnectionTestResultDto,
  UpdateEntraConnectionDto,
} from '../auth/dto/entra-connection.dto';
import {
  MailConnectionResponseDto,
  MailConnectionTestResultDto,
  TestMailConnectionDto,
  UpdateMailConnectionDto,
} from '../mailer/dto/mail-connection.dto';
import {
  KekaConnectionResponseDto,
  KekaConnectionTestResultDto,
  UpdateKekaConnectionDto,
} from '../integrations/keka/dto/keka-connection.dto';
import {
  SaveSetupEntraDto,
  SetupConfigResponseDto,
  SetupStatusResponseDto,
  SetupSuperAdminSummaryDto,
  UnlockSetupResponseDto,
} from './dto/setup.dto';
import { SETUP_TOKEN_PURPOSE } from './guards/setup-token.guard';

const SETUP_TOKEN_TTL_SECONDS = 7200; // 2 hours

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly jwtService: JwtService,
    private readonly entraConnectionService: EntraConnectionService,
    private readonly mailConnectionService: MailConnectionService,
    private readonly kekaConnectionService: KekaConnectionService,
  ) {}

  async getStatus(): Promise<SetupStatusResponseDto> {
    const [appSetting, entraConfigured, mailConfigured, kekaView, superAdmin] =
      await Promise.all([
        this.prisma.appSetting.findUnique({
          where: { id: 'default' },
          select: { setupCompleted: true, setupCompletedAt: true },
        }),
        this.entraConnectionService.isConfigured(),
        this.mailConnectionService.isConfigured(),
        this.kekaConnectionService.getConnectionView(),
        this.findFirstSuperAdmin(),
      ]);

    const setupCompleted = Boolean(appSetting?.setupCompleted);
    const setupRequired = !setupCompleted;
    const redirectToSetup = !setupCompleted && !entraConfigured;

    return {
      setupCompleted,
      setupRequired,
      redirectToSetup,
      entraConfigured,
      mailConfigured,
      kekaConfigured: kekaView.configured,
      hasSuperAdmin: Boolean(superAdmin),
      setupCompletedAt: appSetting?.setupCompletedAt ?? null,
    };
  }

  async unlock(setupKey: string): Promise<UnlockSetupResponseDto> {
    const appSetting = await this.prisma.appSetting.findUnique({
      where: { id: 'default' },
      select: { setupCompleted: true },
    });

    if (appSetting?.setupCompleted) {
      throw new ForbiddenException(
        'Initial setup has already been completed and locked.',
      );
    }

    const expectedKey = this.resolveSetupSecret();
    if (!expectedKey) {
      throw new ForbiddenException(
        'Setup wizard key is not configured on the server (set SETUP_WIZARD_SECRET or BREAK_GLASS_EMERGENCY_SECRET).',
      );
    }

    if (!this.timingSafeEqualStrings(setupKey.trim(), expectedKey)) {
      throw new UnauthorizedException('Invalid setup key.');
    }

    const secret = this.configService.getOrThrow('auth.secret', {
      infer: true,
    });

    const setupToken = await this.jwtService.signAsync(
      { purpose: SETUP_TOKEN_PURPOSE },
      { secret, expiresIn: SETUP_TOKEN_TTL_SECONDS },
    );

    return {
      setupToken,
      expiresInSeconds: SETUP_TOKEN_TTL_SECONDS,
    };
  }

  async getConfig(): Promise<SetupConfigResponseDto> {
    const [entra, mail, keka, superAdmin] = await Promise.all([
      this.entraConnectionService.getConnectionView(),
      this.mailConnectionService.getConnectionView(),
      this.kekaConnectionService.getConnectionView(),
      this.findFirstSuperAdmin(),
    ]);

    return {
      entra,
      mail,
      keka,
      superAdmin,
    };
  }

  async saveEntraAndSuperAdmin(dto: SaveSetupEntraDto): Promise<{
    entra: EntraConnectionResponseDto;
    superAdmin: SetupSuperAdminSummaryDto | null;
  }> {
    const entra = await this.entraConnectionService.updateConnection(
      {
        tenantId: dto.tenantId,
        clientId: dto.clientId,
        clientSecret: dto.clientSecret,
        redirectUri: dto.redirectUri,
      },
      null,
    );

    let superAdmin: SetupSuperAdminSummaryDto | null = null;
    if (dto.superAdminEmail?.trim()) {
      superAdmin = await this.upsertFirstSuperAdmin(
        dto.superAdminEmail.trim().toLowerCase(),
        dto.superAdminName?.trim() || undefined,
      );
    } else {
      superAdmin = await this.findFirstSuperAdmin();
    }

    return { entra, superAdmin };
  }

  testEntra(dto?: UpdateEntraConnectionDto): Promise<EntraConnectionTestResultDto> {
    return this.entraConnectionService.testConnection(null, dto);
  }

  saveMail(dto: UpdateMailConnectionDto): Promise<MailConnectionResponseDto> {
    return this.mailConnectionService.updateConnection(dto, null);
  }

  testMail(dto: TestMailConnectionDto): Promise<MailConnectionTestResultDto> {
    return this.mailConnectionService.testConnection(null, dto);
  }

  saveKeka(dto: UpdateKekaConnectionDto): Promise<KekaConnectionResponseDto> {
    return this.kekaConnectionService.updateConnection(dto, null);
  }

  testKeka(dto?: UpdateKekaConnectionDto): Promise<KekaConnectionTestResultDto> {
    return this.kekaConnectionService.testConnection(null, dto);
  }

  async completeSetup(): Promise<SetupStatusResponseDto> {
    const [entraConfigured, superAdmin] = await Promise.all([
      this.entraConnectionService.isConfigured(),
      this.findFirstSuperAdmin(),
    ]);

    if (!entraConfigured) {
      throw new BadRequestException(
        'Microsoft Entra ID (Tenant ID, Client ID, and Client Secret) must be configured before completing setup.',
      );
    }

    if (!superAdmin) {
      throw new BadRequestException(
        'A first Super Admin email must be configured before completing setup.',
      );
    }

    const now = new Date();
    await this.prisma.appSetting.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        setupCompleted: true,
        setupCompletedAt: now,
      },
      update: {
        setupCompleted: true,
        setupCompletedAt: now,
      },
    });

    await this.ensureDefaultHealthRules();

    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'SETUP_COMPLETED',
          objectType: 'SetupWizard',
          description: `Initial platform setup completed. Primary Super Admin: ${superAdmin.email}`,
          newValue: {
            superAdminEmail: superAdmin.email,
            completedAt: now.toISOString(),
          },
          source: 'SetupWizard',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not record SETUP_COMPLETED audit row: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.getStatus();
  }

  private async upsertFirstSuperAdmin(
    email: string,
    displayName?: string,
  ): Promise<SetupSuperAdminSummaryDto> {
    const superAdminRoleId = ROLE_ID_BY_CODE.super_admin;

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true },
    });

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          roleId: superAdminRoleId,
          isActive: true,
          isExternal: false,
          ...(displayName ? { displayName } : {}),
        },
        select: { email: true, displayName: true },
      });
      return updated;
    }

    const fallbackName = displayName || email.split('@')[0] || 'Super Admin';
    const created = await this.prisma.user.create({
      data: {
        entraObjectId: `pending-setup-${crypto.randomUUID()}`,
        email,
        displayName: fallbackName,
        roleId: superAdminRoleId,
        isActive: true,
        isExternal: false,
      },
      select: { email: true, displayName: true },
    });

    return created;
  }

  private async ensureDefaultHealthRules(): Promise<void> {
    try {
      const admin = await this.prisma.user.findFirst({
        where: { roleId: ROLE_ID_BY_CODE.super_admin, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!admin) return;

      for (const rule of DEFAULT_HEALTH_RULES) {
        const existing = await this.prisma.healthRuleConfig.findFirst({
          where: { dimension: rule.dimension, isActive: true },
        });
        if (!existing) {
          await this.prisma.healthRuleConfig.create({
            data: {
              ...rule,
              version: HEALTH_RULE_VERSION,
              updatedBy: admin.id,
            },
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not ensure default health rules during setup: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async findFirstSuperAdmin(): Promise<SetupSuperAdminSummaryDto | null> {
    const row = await this.prisma.user.findFirst({
      where: {
        roleId: ROLE_ID_BY_CODE.super_admin,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
      select: { email: true, displayName: true },
    });
    return row ?? null;
  }

  private resolveSetupSecret(): string | null {
    const dedicated = this.configService
      .get('auth.setupWizardSecret', { infer: true })
      ?.trim();
    if (dedicated) return dedicated;

    const breakGlass = this.configService
      .get('breakGlass.emergencySecret', { infer: true })
      ?.trim();
    if (breakGlass) return breakGlass;

    return null;
  }

  private timingSafeEqualStrings(a: string, b: string): boolean {
    const hashA = crypto.createHash('sha256').update(a).digest();
    const hashB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  }
}
