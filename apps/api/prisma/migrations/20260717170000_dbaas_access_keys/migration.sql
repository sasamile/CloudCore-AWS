-- Migración aditiva: tablas AccessKey (credenciales de máquina) y Database (DBaaS).
-- Idempotente (IF NOT EXISTS) para ser segura aunque una parte ya exista por `prisma db push`.

-- CreateTable AccessKey
CREATE TABLE IF NOT EXISTS "AccessKey" (
    "id" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'storage',
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "AccessKey_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccessKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessKey_accessKeyId_key" ON "AccessKey"("accessKeyId");
CREATE INDEX IF NOT EXISTS "AccessKey_userId_idx" ON "AccessKey"("userId");

-- CreateTable Database
CREATE TABLE IF NOT EXISTS "Database" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dbName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 5432,
    "status" TEXT NOT NULL DEFAULT 'creating',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Database_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Database_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Database_dbName_key" ON "Database"("dbName");
CREATE INDEX IF NOT EXISTS "Database_userId_idx" ON "Database"("userId");
