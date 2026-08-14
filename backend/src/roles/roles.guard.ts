import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<(number | string)[]>(
      'roles',
      [context.getClass(), context.getHandler()],
    );
    if (!roles?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const roleCode =
      request.user?.role?.code ?? request.user?.roleCode ?? null;

    return roleCode != null && roles.includes(roleCode);
  }
}

