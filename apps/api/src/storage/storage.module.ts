import { Global, Module } from '@nestjs/common';
import { LocalStorageProvider } from './local.storage.js';
import {
  getR2ConfigStatus,
  isR2Configured,
  R2StorageProvider,
} from './r2.storage.js';
import type { StorageProvider } from './storage.types.js';
import { StorageService } from './storage.service.js';
import { LocalPutController } from './local-put.controller.js';
import { STORAGE } from './storage.tokens.js';

export { STORAGE } from './storage.tokens.js';

@Global()
@Module({
  controllers: [LocalPutController],
  providers: [
    {
      provide: STORAGE,
      useFactory: (): StorageProvider => {
        const status = getR2ConfigStatus();
        const requireR2 =
          (process.env.REQUIRE_R2 ?? '').trim().toLowerCase() === 'true' ||
          (process.env.NODE_ENV === 'production' &&
            (process.env.REQUIRE_R2 ?? 'false').toLowerCase() !== 'false' &&
            // só exige se o usuário começou a configurar algo
            (status.accountIdSet ||
              status.accessKeySet ||
              status.secretSet ||
              Boolean(status.bucket)));

        if (isR2Configured()) {
          console.log(
            JSON.stringify({
              storage: 'provider',
              name: 'r2',
              bucket: status.bucket,
              endpoint: status.endpoint,
            }),
          );
          return new R2StorageProvider();
        }

        if (requireR2 && status.missing.length > 0) {
          // Config parcial em prod: falha cedo em vez de gravar no disco do container
          const msg = `R2 incompleto. Faltam: ${status.missing.join(', ')}. Preencha no serviço API ou remova as vars parciais para usar disco local.`;
          console.error(msg);
          if (
            (process.env.REQUIRE_R2 ?? '').trim().toLowerCase() === 'true'
          ) {
            throw new Error(msg);
          }
        }

        console.warn(
          JSON.stringify({
            storage: 'provider',
            name: 'local',
            warning:
              'R2 not configured — using local disk (.data/uploads). Photos will NOT appear in Cloudflare R2.',
            missing: status.missing,
            hint: 'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET on the API service and restart.',
          }),
        );
        return new LocalStorageProvider();
      },
    },
    StorageService,
  ],
  exports: [STORAGE, StorageService],
})
export class StorageModule {}
