-- CreateEnum
CREATE TYPE "OrigenAsignacion" AS ENUM ('AUTOMATICA', 'MANUAL');

-- CreateTable
CREATE TABLE "reglas_asignacion" (
    "id" TEXT NOT NULL,
    "puesto_id" TEXT NOT NULL,
    "centro_costo_id" TEXT NOT NULL,
    "modulo_id" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "reglas_asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "modulo_id" TEXT NOT NULL,
    "modulo_version_id" TEXT,
    "origen" "OrigenAsignacion" NOT NULL DEFAULT 'AUTOMATICA',
    "revocada_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reglas_asignacion_puesto_id_centro_costo_id_modulo_id_key" ON "reglas_asignacion"("puesto_id", "centro_costo_id", "modulo_id");

-- CreateIndex
CREATE INDEX "asignaciones_usuario_id_idx" ON "asignaciones"("usuario_id");

-- CreateIndex: a lo sumo UNA asignación VIGENTE por (usuario, módulo). Tiene que ser un
-- índice único PARCIAL: un UNIQUE común sobre (usuario_id, modulo_id) prohibiría que
-- coexistan una asignación revocada vieja y una vigente nueva del mismo módulo (una
-- recontratación), que es justo lo que el modelo "nunca se borra, se revoca" necesita.
-- Blinda la idempotencia de recalcular() a nivel base: no puede crear una segunda
-- vigente para un módulo que ya tiene una (sea AUTOMATICA o MANUAL).
-- Vive solo acá — Prisma no soporta WHERE en @@unique, así que este índice no se refleja
-- en schema.prisma ni lo introspecta (`migrate diff` dice "in sync"). OJO: por lo mismo,
-- no se recrea solo — un `db push` sobre una base limpia lo deja sin el índice.
CREATE UNIQUE INDEX "asignaciones_usuario_modulo_vigente" ON "asignaciones"("usuario_id", "modulo_id") WHERE "revocada_at" IS NULL;

-- AddForeignKey
ALTER TABLE "reglas_asignacion" ADD CONSTRAINT "reglas_asignacion_puesto_id_fkey" FOREIGN KEY ("puesto_id") REFERENCES "puestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_asignacion" ADD CONSTRAINT "reglas_asignacion_centro_costo_id_fkey" FOREIGN KEY ("centro_costo_id") REFERENCES "centros_costo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_asignacion" ADD CONSTRAINT "reglas_asignacion_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_modulo_version_id_fkey" FOREIGN KEY ("modulo_version_id") REFERENCES "modulo_versiones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
