/*
  Modelo de Vinculación (ver docs/modelo-vinculacion-propuesto.md).

  Warnings:

  - You are about to drop the column `clasificacion` on the `usuarios` table. All the data in the column will be lost.
  - You are about to drop the column `organizacion_id` on the `usuarios` table. All the data in the column will be lost.
  - You are about to drop the column `rol` on the `usuarios` table. All the data in the column will be lost.

  Limpieza previa (§4.1 del documento) ya se corrió a mano antes de esta migración:
  no había usuarios vivos que violaran la matriz clasificación/tipo-de-organización↔rol,
  ni usuarios vivos sin organizacion_id (0 usuarios vivos en la base al momento de migrar).

*/
-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'AUDITOR';

-- CreateTable
CREATE TABLE "vinculaciones" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "organizacion_id" INTEGER NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vinculaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculacion_puesto_centro" (
    "vinculacion_id" INTEGER NOT NULL,
    "puesto_id" TEXT NOT NULL,
    "centro_costo_id" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "vinculacion_puesto_centro_pkey" PRIMARY KEY ("vinculacion_id","puesto_id","centro_costo_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vinculaciones_usuario_id_key" ON "vinculaciones"("usuario_id");

-- CreateIndex: los dos sentidos de la regla de asignación por par exacto ("módulo X
-- a los del centro Y con puesto Z"), para poder entrar por cualquiera de los dos ejes.
CREATE INDEX "vinculacion_puesto_centro_puesto_centro_idx" ON "vinculacion_puesto_centro"("puesto_id", "centro_costo_id", "vinculacion_id");

-- CreateIndex
CREATE INDEX "vinculacion_puesto_centro_centro_puesto_idx" ON "vinculacion_puesto_centro"("centro_costo_id", "puesto_id", "vinculacion_id");

-- CreateIndex: exactamente UN par principal ACTIVO por vinculación. Tiene que ser un
-- índice único PARCIAL: un UNIQUE común sobre (vinculacion_id) prohibiría tener más de
-- un par, y uno sobre (vinculacion_id, principal) dejaría pasar N filas con
-- principal = false.
-- El WHERE incluye "activo" además de "principal": sin eso, un par con principal = true
-- y activo = false (un "principal fantasma", que no debería poder existir) seguía
-- ocupando el lugar único y bloqueaba promover otro par a principal.
-- Vive solo acá — Prisma no soporta WHERE en @@unique, así que este índice no se refleja
-- en schema.prisma. Prisma tampoco lo introspecta, así que le es completamente invisible:
-- `migrate diff` dice "in sync", no reporta drift, y el índice convive sin ruido.
-- OJO: por lo mismo, no se recrea solo. Un `db push` sobre una base limpia, o cualquier
-- regeneración de la tabla que no pase por estas migraciones, la deja sin el índice —
-- vive únicamente en este archivo.
CREATE UNIQUE INDEX "vinculacion_puesto_centro_principal_unico" ON "vinculacion_puesto_centro"("vinculacion_id") WHERE "principal" AND "activo";

-- AddForeignKey
ALTER TABLE "vinculaciones" ADD CONSTRAINT "vinculaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculaciones" ADD CONSTRAINT "vinculaciones_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculacion_puesto_centro" ADD CONSTRAINT "vinculacion_puesto_centro_vinculacion_id_fkey" FOREIGN KEY ("vinculacion_id") REFERENCES "vinculaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculacion_puesto_centro" ADD CONSTRAINT "vinculacion_puesto_centro_puesto_id_fkey" FOREIGN KEY ("puesto_id") REFERENCES "puestos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculacion_puesto_centro" ADD CONSTRAINT "vinculacion_puesto_centro_centro_costo_id_fkey" FOREIGN KEY ("centro_costo_id") REFERENCES "centros_costo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: 1. Una vinculación por usuario vivo. Copia 1-a-1 de usuarios.
-- El JOIN con organizaciones no aporta columnas: descarta usuarios huérfanos
-- sin organizacion_id (ver §4.1 del documento).
INSERT INTO "vinculaciones" (usuario_id, organizacion_id, rol, activa, updated_at, created_by)
SELECT u.id,
       u.organizacion_id,
       u.rol,
       true, CURRENT_TIMESTAMP, 'migracion-vinculacion'
FROM "usuarios" u
JOIN "organizaciones" o ON o.id = u.organizacion_id
WHERE u.deleted_at IS NULL;

-- DataMigration: 2. vinculacion_puesto_centro arranca VACÍA, a propósito — no es un
-- olvido, y no lleva el placeholder 'Sin asignar' de puestos que tenía la versión
-- anterior de esta migración (cuando puesto y centro eran dos pivotes independientes).
-- Por qué se sacó:
--   - El modelo viejo nunca tuvo puesto ni centro de costo en usuarios (ver
--     20260720123709_add_puesto_centro_costo: los catálogos se crearon sin ninguna FK
--     entrante). No hay ningún par real que backfillear — el "puesto principal" de
--     antes era el propio placeholder, no un dato de nómina.
--   - Un par siempre viene completo, así que sostener el placeholder ahora exigiría
--     inventar DOS filas de catálogo (un puesto y un centro 'Sin asignar') y marcar ese
--     par fabricado como principal = true, que es justo el par contra el que matchea la
--     regla de asignación. Con ejes independientes un puesto suelto era ruido inofensivo;
--     con el par es un match espurio.
--   - Cero pares es una cardinalidad válida del pivote (mismo razonamiento con el que ya
--     se dejaba vacía vinculacion_centros_costo), y la base de dev no tiene usuarios
--     vivos, así que el backfill no produciría ninguna fila igual.
-- Se cargan de verdad cuando exista el ABM, sin dejar placeholders que limpiar después.

-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_organizacion_id_fkey";

-- AlterTable: recién ahora, con los datos ya copiados a vinculaciones.
ALTER TABLE "usuarios" DROP COLUMN "clasificacion",
DROP COLUMN "organizacion_id",
DROP COLUMN "rol";

-- DropEnum
DROP TYPE "ClasificacionAlumno";
