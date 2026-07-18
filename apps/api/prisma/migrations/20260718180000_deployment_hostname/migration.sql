-- URL pública por proyecto (subdominio enrutado vía nginx + túnel).
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "hostname" TEXT;
