-- Reglas de asignación a NIVEL CENTRO DE COSTO: puesto_id nullable, donde NULL
-- significa "aplica a todos los puestos de ese centro". Las reglas por par exacto
-- (puesto + centro) siguen funcionando igual — el cambio es puramente ADITIVO:
-- relaja el NOT NULL, no reinterpreta ninguna fila existente. No hay backfill: toda
-- regla ya cargada conserva su puesto_id y su significado.

-- AlterTable
ALTER TABLE "reglas_asignacion" ALTER COLUMN "puesto_id" DROP NOT NULL;

-- CreateIndex: una sola regla de CENTRO por (centro, módulo). Tiene que ser un índice
-- PARCIAL por dos razones:
--   1. El @@unique del triple (puesto, centro, módulo) NO cubre este caso: con
--      puesto_id NULL, Postgres considera cada fila distinta de las demás y dejaría
--      entrar dos reglas de centro idénticas. Sigue cubriendo, en cambio, con exactitud
--      las reglas CON puesto — por eso no hace falta un segundo índice a mano.
--   2. Un UNIQUE común sobre (centro_costo_id, modulo_id) prohibiría que la regla de
--      centro y las reglas por par del mismo centro+módulo coexistan, que es justo lo
--      que el modelo necesita ("Básico → Taller" para todos + "Básico → (Soldador,
--      Taller)" para los soldadores).
-- Vive solo acá — Prisma no soporta WHERE en @@unique, así que este índice no se refleja
-- en schema.prisma ni lo introspecta (`migrate diff` dice "in sync"). Mismo patrón que
-- vinculacion_puesto_centro_principal_unico y asignaciones_usuario_modulo_vigente.
-- OJO: por lo mismo, no se recrea solo — un `db push` sobre una base limpia lo deja afuera.
CREATE UNIQUE INDEX "reglas_asignacion_centro_modulo_sin_puesto"
  ON "reglas_asignacion"("centro_costo_id", "modulo_id")
  WHERE "puesto_id" IS NULL;
