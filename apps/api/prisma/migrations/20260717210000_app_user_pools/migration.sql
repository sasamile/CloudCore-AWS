-- Pool de usuarios por app registrada (equivalente a Cognito User Pools).
-- Idempotente: usa IF NOT EXISTS / DO ... EXCEPTION para no romper redeployments.

-- 1) Tabla AppUser
CREATE TABLE IF NOT EXISTS "AppUser" (
  "id"                  TEXT NOT NULL,
  "clientId"            TEXT NOT NULL,
  "email"               TEXT NOT NULL,
  "name"                TEXT,
  "passwordHash"        TEXT NOT NULL,
  "emailVerified"       BOOLEAN NOT NULL DEFAULT false,
  "mfaEnabled"          BOOLEAN NOT NULL DEFAULT false,
  "mfaSecretEnc"        TEXT,
  "mfaBackupCodes"      TEXT,
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_clientId_email_key" ON "AppUser"("clientId", "email");
CREATE INDEX IF NOT EXISTS "AppUser_clientId_idx" ON "AppUser"("clientId");

-- 2) AuthCode: userId nullable + columna appUserId
ALTER TABLE "AuthCode" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "AuthCode" ADD COLUMN IF NOT EXISTS "appUserId" TEXT;

DO $$ BEGIN
  ALTER TABLE "AuthCode" ADD CONSTRAINT "AuthCode_appUserId_fkey"
    FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) OidcRefreshToken: userId nullable + columna appUserId
ALTER TABLE "OidcRefreshToken" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "OidcRefreshToken" ADD COLUMN IF NOT EXISTS "appUserId" TEXT;

DO $$ BEGIN
  ALTER TABLE "OidcRefreshToken" ADD CONSTRAINT "OidcRefreshToken_appUserId_fkey"
    FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
