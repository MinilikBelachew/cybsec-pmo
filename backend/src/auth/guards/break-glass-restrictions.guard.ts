import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';


@Injectable()
export class BreakGlassRestrictionsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.breakGlass) {
      return true;
    }

    const method = request.method.toUpperCase();
    const url = (request.url as string) || '';

    if (url.includes('/users/') && (method === 'PATCH' || method === 'DELETE')) {
      throw new ForbiddenException(
        'Break-glass sessions cannot modify or remove user accounts',
      );
    }

    if (url.includes('/audit/') && method !== 'GET') {
      throw new ForbiddenException(
        'Break-glass sessions cannot modify audit logs',
      );
    }

    return true;
  }
}
