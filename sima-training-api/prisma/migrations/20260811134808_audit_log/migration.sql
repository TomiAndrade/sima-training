-- Story 9 del sprint 07-08: historial de cambios para ISO 9001 (docs/pendientes.md).
-- Paso 1 de 5 — SOLO el modelo y esta migración. Sin services, controllers ni
-- enganches todavía: la tabla existe pero nadie escribe en ella hasta el paso 2.
--
-- Decisiones que el SQL no cuenta solo:
--
--   * `entidad_id` es TEXT y NO lleva foreign key a ninguna tabla. Es una
--     EXCEPCIÓN DELIBERADA a la convención del resto del schema (todo lo demás
--     usa FK tipada) — audit_logs es POLIMÓRFICA: guarda cambios de
--     Vinculacion, VinculacionPuestoCentro y lo que se sume después, y una
--     tabla polimórfica no puede tener una FK a "la entidad que corresponda".
--     Por eso TEXT y no UUID/INTEGER: las PK reales del proyecto son de los
--     dos tipos según la tabla (uuid vs. autoincrement), y esta columna tiene
--     que poder guardar cualquiera de los dos como string.
--
--   * NO hay updated_at/updated_by/deleted_at. audit_logs es INMUTABLE y no se
--     borra — mismo tratamiento que sesiones y modulo_versiones: es un hecho
--     histórico, y editar o dar de baja (aunque sea lógicamente) una fila de
--     auditoría le pega directo al propósito de la tabla.
--
--   * `actor` es TEXT libre, no FK a usuarios. Hoy los actores son los mismos
--     strings genéricos que ya usa created_by en el resto del schema
--     ("backoffice", "import", "tablet") porque no existen cuentas de sistema
--     todavía. El día que existan, se guarda el id de esa cuenta ahí mismo,
--     sin migrar nada.
--
--   * `diff` es JSONB con la forma `{ campo: { antes, despues } }`, sólo los
--     campos que cambiaron. La forma varía por entidad y nunca se consulta
--     por adentro (ni filtro ni índice sobre su contenido) — se lee entera
--     para mostrarla, así que no hay razón para forzarle una columna tipada.
--
--   * Los dos índices son ambos b-tree comunes, sin WHERE ni CHECK: esta tabla
--     no necesita ninguno de los dos (no hay estados que se pisen entre sí, no
--     hay unicidad que cuidar). El compuesto (entidad, entidad_id) sirve al
--     caso de uso real —"el log de esta persona", paso 4 de esta story—; el de
--     created_at sirve a un log global ordenado por fecha, que todavía no
--     existe pero es la lectura obvia siguiente.
--
--   * No hay AddForeignKey en este archivo a propósito: es la única tabla del
--     proyecto sin ninguna FK saliente, así que no le hace falta entrar a la
--     cadena de limpiar() de prisma/seed.ts por orden de dependencia — entra
--     igual, para que el seed sea reproducible, pero puede ir en cualquier
--     lugar de esa función.

-- CreateEnum
CREATE TYPE "AccionAudit" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "accion" "AccionAudit" NOT NULL,
    "diff" JSONB NOT NULL,
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entidad_entidad_id_idx" ON "audit_logs"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
