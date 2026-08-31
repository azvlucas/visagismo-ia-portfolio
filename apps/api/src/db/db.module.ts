import { Global, Module } from '@nestjs/common';
import { createDb, type Db } from '@visagismo/db';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Db | null => {
        const url = process.env.DATABASE_URL?.trim();
        const requireDb =
          (process.env.REQUIRE_DB ?? 'false').toLowerCase() === 'true';
        if (!url) {
          if (requireDb) {
            throw new Error('REQUIRE_DB=true but DATABASE_URL is not set');
          }
          console.warn('DATABASE_URL not set — DB features disabled');
          return null;
        }
        console.log('Database: configured');
        return createDb(url);
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
