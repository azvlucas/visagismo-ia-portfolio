export type StorageProviderName = 'r2' | 'local';

export interface PresignPutResult {
  provider: StorageProviderName;
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  method: 'PUT';
}

export interface ObjectMeta {
  key: string;
  bytes: number;
  contentType?: string;
  exists: boolean;
}

export interface StorageProvider {
  readonly name: StorageProviderName;
  presignPut(input: {
    key: string;
    mime: string;
    bytes: number;
    expiresSeconds?: number;
  }): Promise<PresignPutResult>;
  putObject(input: {
    key: string;
    body: Buffer;
    mime: string;
  }): Promise<void>;
  getObject(key: string): Promise<Buffer | null>;
  headObject(key: string): Promise<ObjectMeta>;
  deleteObject(key: string): Promise<void>;
}
