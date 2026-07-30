-- Eliminar una regla pasa a ser BAJA LÓGICA (deleted_at), no un DELETE: la fila es
-- la única evidencia de por qué alguien tuvo que rendir un módulo, y el resto del
-- proyecto ya no borra nada (deleted_at en usuarios/vinculaciones/catálogos,
-- revocada_at en asignaciones). Es un eje distinto de `activo`: desactivada sigue
-- visible y reactivable, eliminada deja de existir a todos los efectos.
--
-- Cambio ADITIVO: toda regla existente queda con deleted_at NULL = viva. Sin backfill.

-- AlterTable
ALTER TABLE "reglas_asignacion" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- DropIndex + CreateIndex: el @@unique del triple que generaba Prisma no distingue
-- filas vivas de eliminadas, así que una regla eliminada seguiría bloqueando la
-- creación de otra con el mismo (puesto, centro, módulo). Se reemplaza por el mismo
-- índice PARCIAL, restringido a las vivas. Sigue cubriendo exactamente las reglas CON
-- puesto: con puesto_id NULL, Postgres considera cada fila distinta de las demás.
DROP INDEX "reglas_asignacion_puesto_id_centro_costo_id_modulo_id_key";
CREATE UNIQUE INDEX "reglas_asignacion_par_modulo_vivas"
  ON "reglas_asignacion"("puesto_id", "centro_costo_id", "modulo_id")
  WHERE "deleted_at" IS NULL;

-- Mismo motivo para la unicidad de las reglas de CENTRO (20260727120006): al predicado
-- de alcance se le suma el de vida. Los dos son ortogonales — puesto_id elige QUÉ
-- ALCANCE gobierna el índice, deleted_at elige QUÉ FILAS están vivas — así que se
-- combinan en vez de unificarse en un solo índice. Se recrea entero porque Postgres no
-- permite alterar el WHERE de un índice existente.
DROP INDEX "reglas_asignacion_centro_modulo_sin_puesto";
CREATE UNIQUE INDEX "reglas_asignacion_centro_modulo_sin_puesto"
  ON "reglas_asignacion"("centro_costo_id", "modulo_id")
  WHERE "puesto_id" IS NULL AND "deleted_at" IS NULL;

-- Los DOS índices de esta tabla son ahora parciales y viven sólo acá: Prisma no expresa
-- WHERE en @@unique ni los introspecta (`migrate diff` dice "in sync"), y un `db push`
-- sobre una base limpia los deja afuera. Mismo patrón que
-- vinculacion_puesto_centro_principal_unico y asignaciones_usuario_modulo_vigente.
