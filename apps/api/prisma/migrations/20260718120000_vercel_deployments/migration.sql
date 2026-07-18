-- Modelo Vercel: instancia de deploy por defecto (oculta) + metadatos de proyecto.
-- Idempotente para no romper redeployments.

-- Instancia del sistema (default) usada para desplegar proyectos sin que el usuario cree instancias.
ALTER TABLE "Instance" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Metadatos del proyecto desplegado.
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "framework" TEXT;
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "port" INTEGER;
