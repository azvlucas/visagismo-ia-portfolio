import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { SignJWT, jwtVerify } from 'jose';
import { ApiHttpException } from '../common/http-error.js';
import {
  memoryAdminUsers,
  type AdminRole,
  type AdminUserRecord,
} from './admin-users.memory.js';

export interface AdminAccessClaims {
  sub: string;
  email: string;
  role: AdminRole;
  aud: 'admin_access';
}

function secretKey() {
  const s =
    process.env.ADMIN_JWT_SECRET ??
    process.env.ORDER_SESSION_SECRET ??
    'dev-only-admin-jwt-secret!!';
  if (!process.env.ADMIN_JWT_SECRET) {
    console.warn('ADMIN_JWT_SECRET missing — using dev fallback');
  }
  return new TextEncoder().encode(s);
}

@Injectable()
export class AdminAuthService implements OnModuleInit {
  async onModuleInit() {
    await this.ensureSeedAdmin();
  }

  async ensureSeedAdmin() {
    const configuredEmail = process.env.ADMIN_EMAIL?.trim();
    const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
    if (
      process.env.NODE_ENV === 'production' &&
      (!configuredEmail || !configuredPassword || configuredPassword.length < 16)
    ) {
      throw new Error(
        'Production requires ADMIN_EMAIL and an ADMIN_PASSWORD with at least 16 characters',
      );
    }

    const email = (configuredEmail || 'admin@localhost').toLowerCase();
    if (memoryAdminUsers.getByEmail(email)) return;

    const password = configuredPassword || 'change-me-local-admin-password';
    const passwordHash = await hash(password);
    const now = new Date();
    const user: AdminUserRecord = {
      id: randomUUID(),
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    memoryAdminUsers.save(user);
    console.log(
      JSON.stringify({
        admin_seed: true,
        email,
        hint: 'Login em /admin com ADMIN_EMAIL / ADMIN_PASSWORD do .env',
      }),
    );
  }

  async login(email: string, password: string) {
    const user = memoryAdminUsers.getByEmail(email.trim());
    if (!user || !user.isActive) {
      throw new ApiHttpException(
        'UNAUTHORIZED',
        HttpStatus.UNAUTHORIZED,
        'Credenciais inválidas.',
      );
    }

    const ok = await verify(user.passwordHash, password);
    if (!ok) {
      throw new ApiHttpException(
        'UNAUTHORIZED',
        HttpStatus.UNAUTHORIZED,
        'Credenciais inválidas.',
      );
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    try {
      const { payload } = await jwtVerify(refreshToken, secretKey(), {
        audience: 'admin_refresh',
        algorithms: ['HS256'],
      });
      const jti = payload.jti;
      const sub = payload.sub;
      if (!jti || !sub) {
        throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
      }
      const stored = memoryAdminUsers.takeRefresh(jti);
      if (!stored || stored.userId !== sub) {
        throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
      }
      // rotate
      memoryAdminUsers.revokeRefresh(jti);
      const user = memoryAdminUsers.getById(sub);
      if (!user || !user.isActive) {
        throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
      }
      return this.issueTokens(user);
    } catch (err) {
      if (err instanceof ApiHttpException) throw err;
      throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return { ok: true };
    try {
      const { payload } = await jwtVerify(refreshToken, secretKey(), {
        audience: 'admin_refresh',
        algorithms: ['HS256'],
      });
      if (payload.jti) memoryAdminUsers.revokeRefresh(payload.jti);
    } catch {
      // ignore
    }
    return { ok: true };
  }

  async verifyAccessToken(token: string): Promise<AdminAccessClaims> {
    try {
      const { payload } = await jwtVerify(token, secretKey(), {
        audience: 'admin_access',
        algorithms: ['HS256'],
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        (payload.role !== 'admin' && payload.role !== 'operator')
      ) {
        throw new Error('bad claims');
      }
      const user = memoryAdminUsers.getById(payload.sub);
      if (!user || !user.isActive) throw new Error('inactive');
      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role as AdminRole,
        aud: 'admin_access',
      };
    } catch {
      throw new ApiHttpException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
  }

  private async issueTokens(user: AdminUserRecord) {
    const access = await new SignJWT({
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setAudience('admin_access')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secretKey());

    const jti = randomUUID();
    const refreshExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const refresh = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setAudience('admin_refresh')
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(refreshExp)
      .sign(secretKey());

    memoryAdminUsers.saveRefresh(jti, user.id, refreshExp);

    return {
      accessToken: access,
      refreshToken: refresh,
      expiresIn: 15 * 60,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
