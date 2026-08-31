import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://visagismo:visagismo@localhost:5432/visagismo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, '..', 'drizzle');

async function main() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  console.log(`Migrating with ${migrationsFolder}…`);
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied.');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
