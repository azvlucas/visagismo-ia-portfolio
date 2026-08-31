import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  ObjectMeta,
  PresignPutResult,
  StorageProvider,
} from './storage.types.js';

function envTrim(key: string): string {
  return (process.env[key] ?? '').trim();
}

/** Diagnóstico sem vazar secrets (para /health e logs). */
export function getR2ConfigStatus(): {
  configured: boolean;
  missing: string[];
  accountIdSet: boolean;
  accessKeySet: boolean;
  secretSet: boolean;
  bucket: string | null;
  endpoint: string | null;
} {
  const accountId = envTrim('R2_ACCOUNT_ID');
  const accessKey = envTrim('R2_ACCESS_KEY_ID');
  const secret = envTrim('R2_SECRET_ACCESS_KEY');
  const bucket = envTrim('R2_BUCKET');
  const missing: string[] = [];
  if (!accountId) missing.push('R2_ACCOUNT_ID');
  if (!accessKey) missing.push('R2_ACCESS_KEY_ID');
  if (!secret) missing.push('R2_SECRET_ACCESS_KEY');
  if (!bucket) missing.push('R2_BUCKET');

  const endpoint =
    envTrim('R2_ENDPOINT') ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);

  return {
    configured: missing.length === 0,
    missing,
    accountIdSet: Boolean(accountId),
    accessKeySet: Boolean(accessKey),
    secretSet: Boolean(secret),
    bucket: bucket || null,
    endpoint,
  };
}

export function isR2Configured(): boolean {
  return getR2ConfigStatus().configured;
}

export class R2StorageProvider implements StorageProvider {
  readonly name = 'r2' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor() {
    const accountId = envTrim('R2_ACCOUNT_ID');
    this.endpoint =
      envTrim('R2_ENDPOINT') ||
      `https://${accountId}.r2.cloudflarestorage.com`;
    this.bucket = envTrim('R2_BUCKET');

    this.client = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: envTrim('R2_ACCESS_KEY_ID'),
        secretAccessKey: envTrim('R2_SECRET_ACCESS_KEY'),
      },
      // R2 S3 API: path-style é o padrão recomendado
      forcePathStyle: true,
    });

    console.log(
      JSON.stringify({
        storage: 'r2',
        bucket: this.bucket,
        endpoint: this.endpoint,
        accountIdPrefix: accountId.slice(0, 6) + '…',
      }),
    );
  }

  async presignPut(input: {
    key: string;
    mime: string;
    bytes: number;
    expiresSeconds?: number;
  }): Promise<PresignPutResult> {
    const expiresSeconds = input.expiresSeconds ?? 15 * 60;
    // Não assinar ContentLength no presign: clientes mobile variam o header
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.mime,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: expiresSeconds,
    });

    return {
      provider: 'r2',
      key: input.key,
      uploadUrl,
      headers: {
        'Content-Type': input.mime,
      },
      expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString(),
      method: 'PUT',
    };
  }

  async putObject(input: {
    key: string;
    body: Buffer;
    mime: string;
  }): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.mime,
          ContentLength: input.body.length,
        }),
      );
      console.log(
        JSON.stringify({
          storage: 'r2',
          event: 'put_ok',
          key: input.key,
          bytes: input.body.length,
          bucket: this.bucket,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          storage: 'r2',
          event: 'put_error',
          key: input.key,
          bucket: this.bucket,
          error: message,
        }),
      );
      throw new Error(
        `Falha ao gravar no R2 (${this.bucket}/${input.key}): ${message}`,
      );
    }
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      console.warn(
        JSON.stringify({
          storage: 'r2',
          event: 'get_miss',
          key,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return null;
    }
  }

  async headObject(key: string): Promise<ObjectMeta> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        key,
        bytes: res.ContentLength ?? 0,
        contentType: res.ContentType,
        exists: true,
      };
    } catch {
      return { key, bytes: 0, exists: false };
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
