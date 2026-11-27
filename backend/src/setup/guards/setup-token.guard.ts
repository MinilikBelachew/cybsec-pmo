import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AllConfigType } from '../../config/config.type';
import { PrismaService } from '../../database/prisma.service';

export const SETUP_TOKEN_PURPOSE = 'setup_wizard';

@Injectable()
export class SetupTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const appSetting = await this.prisma.appSetting.findUnique({
      where: { id: 'default' },
      select: { setupCompleted: true },
    });

    if (appSetting?.setupCompleted) {
      throw new ForbiddenException(
        'Initial setup has already been completed and locked.',
      );
    }

    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const token = this.extractToken(request.headers ?? {});
    if (!token) {
      throw new UnauthorizedException('Setup wizard token is required.');
    }

    const secret = this.configService.getOrThrow('auth.secret', {
      infer: true,
    });

    try {
      const payload = await this.jwtService.verifyAsync<{
        purpose?: string;
      }>(token, { secret });

      if (payload?.purpose !== SETUP_TOKEN_PURPOSE) {
        throw new UnauthorizedException('Invalid setup wizard token.');
      }

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new UnauthorizedException(
        'Setup wizard session has expired. Please unlock with your setup key again.',
      );
    }
  }

  private extractToken(
    headers: Record<string, string | string[] | undefined>,
  ): string | null {
    const custom = headers['x-setup-token'];
    if (typeof custom === 'string' && custom.trim()) {
      return custom.trim();
    }

    const auth = headers['authorization'];
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      const token = auth.slice(7).trim();
      return token || null;
    }

    return null;
  }
}
