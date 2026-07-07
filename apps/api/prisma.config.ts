import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env') });
config();

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://zyncloud:zyncloud@localhost:5432/zyncloud';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
