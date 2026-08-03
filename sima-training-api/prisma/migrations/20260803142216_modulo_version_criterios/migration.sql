-- Entrega B de bases de conocimiento: un módulo declara QUÉ evalúa (base + nivel)
-- en vez de enumerar preguntas una por una. Ver docs/pendientes.md.
--
-- Cambio ADITIVO y sin backfill: la tabla nace vacía y `origen` entra con DEFAULT
-- 'MANUAL', que es la verdad de todos los pivots existentes — se cargaron uno por
-- uno desde el banco, ningún criterio los trajo.
--
-- NO hay columna `cantidad_preguntas` (decisión del 2026-08-03, revierte el diseño
-- original): sería cuántas sortear por examen, y el sorteo no existe todavía (la
-- tablet toma 3 fijas y no lee el backend). Se agregaría como columna nullable, sin
-- backfill, el día que exista — mientras tanto el pool se materializa ENTERO.
--
-- Las DOS foreign keys a la clasificación no son redundantes, mismo patrón que
-- `preguntas` (20260731143856):
--
--   modulo_version_criterios_base_conocimiento_id_fkey            → la base existe
--   modulo_version_criterios_nivel_id_base_conocimiento_id_fkey   → el nivel existe Y ES DE ESA BASE
--
-- La segunda es COMPUESTA y apunta a niveles_base(id, base_conocimiento_id), que
-- es para lo que existe ese @@unique. Con esto "el nivel del criterio pertenece a
-- su base" lo garantiza Postgres y no un findFirst previo en el service, que no
-- sobreviviría a dos escrituras concurrentes.
--
-- A diferencia de `preguntas`, acá NO va el CHECK `nivel_requiere_base`: el agujero
-- de MATCH SIMPLE que ese CHECK tapa es "nivel_id cargado con base NULL", y acá
-- base_conocimiento_id es NOT NULL, así que no se puede dar.

-- CreateEnum
-- Enum PROPIO, no OrigenAsignacion: comparte la idea (derivado vs. manual) y la
-- regla (resolver criterios nunca toca las MANUAL), pero no los valores — acá el
-- derivado es CRITERIO, no AUTOMATICA.
CREATE TYPE "OrigenPregunta" AS ENUM ('CRITERIO', 'MANUAL');

-- AlterTable
ALTER TABLE "modulo_version_preguntas" ADD COLUMN     "origen" "OrigenPregunta" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "modulo_version_criterios" (
    "id" TEXT NOT NULL,
    "modulo_version_id" TEXT NOT NULL,
    "base_conocimiento_id" TEXT NOT NULL,
    "nivel_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "modulo_version_criterios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modulo_version_criterios_modulo_version_id_base_conocimient_key" ON "modulo_version_criterios"("modulo_version_id", "base_conocimiento_id", "nivel_id");

-- AddForeignKey
ALTER TABLE "modulo_version_criterios" ADD CONSTRAINT "modulo_version_criterios_modulo_version_id_fkey" FOREIGN KEY ("modulo_version_id") REFERENCES "modulo_versiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulo_version_criterios" ADD CONSTRAINT "modulo_version_criterios_base_conocimiento_id_fkey" FOREIGN KEY ("base_conocimiento_id") REFERENCES "bases_conocimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulo_version_criterios" ADD CONSTRAINT "modulo_version_criterios_nivel_id_base_conocimiento_id_fkey" FOREIGN KEY ("nivel_id", "base_conocimiento_id") REFERENCES "niveles_base"("id", "base_conocimiento_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índice único PARCIAL escrito a mano: el @@unique de arriba (la línea
-- CreateIndex que generó Prisma) cubre SÓLO los criterios con nivel. Con
-- nivel_id NULL, Postgres considera cada fila distinta de las demás, así que no
-- impide declarar dos veces "cualquier nivel de esta base" sobre la misma
-- versión. Este índice cubre exactamente esa otra mitad.
--
-- Prisma no expresa WHERE en @@unique ni lo introspecta (`migrate diff` va a
-- decir "in sync"), y un `db push` sobre una base limpia lo deja afuera. Es el
-- QUINTO índice parcial invisible del proyecto — los otros cuatro son
-- vinculacion_puesto_centro_principal_unico, asignaciones_usuario_modulo_vigente,
-- reglas_asignacion_par_modulo_vivas y reglas_asignacion_centro_modulo_sin_puesto.
-- Está anotado en docs/pendientes.md.
--
-- Ojo con el paralelo con ReglaAsignacion: allá se DROPEÓ el @@unique de Prisma
-- porque el eje deleted_at atraviesa los dos alcances y ninguna mitad quedaba
-- cubierta por un índice plano. Acá no hay soft-delete, así que el @@unique
-- plano cubre entera la mitad nivel_id NOT NULL y se conserva.
CREATE UNIQUE INDEX "modulo_version_criterio_base_sin_nivel"
  ON "modulo_version_criterios"("modulo_version_id", "base_conocimiento_id")
  WHERE "nivel_id" IS NULL;
