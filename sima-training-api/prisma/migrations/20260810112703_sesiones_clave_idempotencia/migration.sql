-- AlterTable
ALTER TABLE "sesiones" ADD COLUMN     "clave_idempotencia" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sesiones_clave_idempotencia_key" ON "sesiones"("clave_idempotencia");

