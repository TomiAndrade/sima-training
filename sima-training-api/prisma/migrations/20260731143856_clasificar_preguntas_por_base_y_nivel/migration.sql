-- Clasificación de preguntas: base de conocimiento (el TEMA) + nivel (la
-- DIFICULTAD dentro de esa base) + fuente.
--
-- Cambio ADITIVO y sin backfill: las tres columnas son NULLABLE. El banco ya
-- tenía preguntas cargadas y no hay forma de derivar la base del texto, así que
-- un NOT NULL obligaría a inventar una base "sin clasificar" para todas. El
-- formulario de alta sí las exige; el filtro ?sinBase=true es lo que permite ir
-- limpiando el backlog existente.
--
-- Las DOS foreign keys de abajo no son redundantes:
--
--   preguntas_base_conocimiento_id_fkey            → la base existe
--   preguntas_nivel_id_base_conocimiento_id_fkey   → el nivel existe Y ES DE ESA BASE
--
-- La segunda es COMPUESTA y apunta a niveles_base(id, base_conocimiento_id) —
-- por eso la migración anterior creó ese índice único, que no es una unicidad
-- de negocio sino el requisito de Postgres para poder referenciarlo. Con esto
-- "el nivel de una pregunta pertenece a su base" es una garantía de la base de
-- datos, no disciplina del service.
--
-- El CHECK del final tapa el agujero que deja MATCH SIMPLE (el default de
-- Postgres para FKs compuestas): si ALGUNA columna de la FK es NULL, la
-- constraint entera no se evalúa. Eso es lo que queremos para (base cargada,
-- nivel NULL) —"tema definido, dificultad pendiente" es un estado válido—, pero
-- también dejaría pasar el inverso (nivel_id cargado con base_conocimiento_id
-- NULL), que es incoherente: un nivel no existe fuera de su base.
--
-- Ojo: ese CHECK vive SÓLO acá. Prisma no lo expresa en el schema ni lo
-- introspecta, así que un `db push` sobre una base limpia lo deja afuera —
-- mismo problema que los cuatro índices únicos parciales del proyecto. Está
-- anotado en docs/pendientes.md.

-- AlterTable
ALTER TABLE "preguntas" ADD COLUMN     "base_conocimiento_id" TEXT,
ADD COLUMN     "fuente" TEXT,
ADD COLUMN     "nivel_id" TEXT;

-- AddForeignKey
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_base_conocimiento_id_fkey" FOREIGN KEY ("base_conocimiento_id") REFERENCES "bases_conocimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_nivel_id_base_conocimiento_id_fkey" FOREIGN KEY ("nivel_id", "base_conocimiento_id") REFERENCES "niveles_base"("id", "base_conocimiento_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK escrito a mano (Prisma no lo genera ni lo conoce): un nivel sin base es
-- un estado incoherente que la FK compuesta deja pasar por MATCH SIMPLE.
ALTER TABLE "preguntas" ADD CONSTRAINT "preguntas_nivel_requiere_base"
  CHECK ("nivel_id" IS NULL OR "base_conocimiento_id" IS NOT NULL);
