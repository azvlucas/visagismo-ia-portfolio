import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  ObjectMeta,
  PresignPutResult,
  StorageProvider,
} from './storage.types.js';

/**
 * Local disk storage for dev without R2.
 * Client PUTs to API `/v1/public/storage/local-put?token=...` with the signed token.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;
  private readonly root: string;
  private readonly tokenSecret: Buffer;

  constructor(rootDir?: string) {
    this.root = rootDir ?? join(process.cwd(), '.data', 'uploads');
    const secret =
      process.env.ORDER_TOKEN_SECRET ?? 'dev-only-local-storage-secret';
    this.tokenSecret = Buffer.from(secret, 'utf8');
  }

  async ensureRoot() {
    await mkdir(this.root, { recursive: true });
  }

  private abs(key: string) {
    // prevent path traversal
    const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return join(this.root, safe);
  }

  signLocalPutToken(key: string, mime: string, expUnix: number): string {
    const payload = `${key}|${mime}|${expUnix}`;
    const sig = createHmac('sha256', this.tokenSecret)
      .update(payload)
      .digest('base64url');
    return Buffer.from(`${payload}|${sig}`).toString('base64url');
  }

  verifyLocalPutToken(
    token: string,
  ): { key: string; mime: string } | null {
    try {
      const raw = Buffer.from(token, 'base64url').toString('utf8');
      const parts = raw.split('|');
      if (parts.length !== 4) return null;
      const [key, mime, expStr, sig] = parts;
      if (!key || !mime || !expStr || !sig) return null;
      const exp = Number(expStr);
      if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      const payload = `${key}|${mime}|${exp}`;
      const expected = createHmac('sha256', this.tokenSecret)
        .update(payload)
        .digest('base64url');
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      return { key, mime };
    } catch {
      return null;
    }
  }

  async presignPut(input: {
    key: string;
    mime: string;
    bytes: number;
    expiresSeconds?: number;
  }): Promise<PresignPutResult> {
    await this.ensureRoot();
    const expiresSeconds = input.expiresSeconds ?? 15 * 60;
    const exp = Math.floor(Date.now() / 1000) + expiresSeconds;
    const token = this.signLocalPutToken(input.key, input.mime, exp);
    const base =
      process.env.API_PUBLIC_URL ??
      process.env.API_URL ??
      `http://localhost:${process.env.PORT ?? 3001}`;
    const uploadUrl = `${base.replace(/\/$/, '')}/v1/public/storage/local-put?token=${encodeURIComponent(token)}`;

    return {
      provider: 'local',
      key: input.key,
      uploadUrl,
      headers: {
        'Content-Type': input.mime,
        'Content-Length': String(input.bytes),
      },
      expiresAt: new Date(exp * 1000).toISOString(),
      method: 'PUT',
    };
  }

  async putObject(input: {
    key: string;
    body: Buffer;
    mime: string;
  }): Promise<void> {
    await this.ensureRoot();
    const path = this.abs(input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);
    console.log(
      JSON.stringify({
        storage: 'local',
        event: 'put_ok',
        key: input.key,
        bytes: input.body.length,
        path,
        warning: 'NOT Cloudflare R2 — file is only on container disk',
      }),
    );
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.abs(key));
    } catch {
      return null;
    }
  }

  async headObject(key: string): Promise<ObjectMeta> {
    try {
      const s = await stat(this.abs(key));
      return { key, bytes: s.size, exists: true };
    } catch {
      return { key, bytes: 0, exists: false };
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await unlink(this.abs(key));
    } catch {
      // ignore
    }
  }
}

export function randomObjectSuffix(): string {
  return randomBytes(8).toString('hex');
}
