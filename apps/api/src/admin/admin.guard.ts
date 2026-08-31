import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ApiHttpException } from '../common/http-error.js';
import { AdminAuthService, type AdminAccessClaims } from './admin-auth.service.js';
import type { AdminRole } from './admin-users.memory.js';

export const ROLES_KEY = 'admin_roles';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

export type AuthedRequest = Request & { admin?: AdminAccessClaims };

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    const token = header.slice(7);
    const claims = await this.auth.verifyAccessToken(token);
    req.admin = claims;

    const required = this.reflector.getAllAndOverride<AdminRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required?.length && !required.includes(claims.role)) {
      throw new ApiHttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
