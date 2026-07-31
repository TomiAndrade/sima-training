-- Bases de conocimiento + su escala de niveles: los dos ejes con los que se
-- clasifica el banco de preguntas (el TEMA y la DIFICULTAD), que hasta ahora
-- estaban colapsados en el nombre del módulo ("SIMA Básico" / "Intermedio" /
-- "Avanzado" mezclan adentro residuos, altura y LOTO sin distinguirlos).
--
-- Cambio ADITIVO: dos tablas nuevas, nada existente se toca. `preguntas`
-- todavía no las referencia — eso entra en la migración siguiente, junto con la
-- FK compuesta y su CHECK.
--
-- Tres decisiones que quedan grabadas en el SQL de abajo:
--
-- 1) `niveles_base` es una TABLA y no un enum porque la escala es POR BASE: una
--    base puede necesitar 3 niveles y otra 5. Un enum global impondría la misma
--    escala a todas.
--
-- 2) `niveles_base_id_base_conocimiento_id_key` NO es una unicidad de negocio
--    (`id` ya es PK). Existe sólo para que la próxima migración pueda declarar
--    la FK COMPUESTA (nivel_id, base_conocimiento_id) → (id,
--    base_conocimiento_id) en `preguntas`: con eso la base de datos garantiza
--    que el nivel de una pregunta pertenece a su base, sin chequeo en el
--    service. Postgres exige un índice único sobre las columnas referenciadas.
--
-- 3) La FK de `niveles_base` es ON DELETE RESTRICT explícito y no el default de
--    Prisma — convención del proyecto para relaciones nuevas (ver
--    ReglaAsignacion.puesto). Verificado acá en el SQL, que es donde el
--    onDelete efectivo se lee de verdad.
--
-- Ojo con el índice (base_conocimiento_id, orden): NO es diferible, así que
-- reordenar la escala con un UPDATE por fila lo viola a mitad de camino aunque
-- esté dentro de una transacción. El service reindexa en dos pasadas (toda la
-- escala a negativos y recién después a los valores finales). Mismo problema
-- que el `principal` de vinculacion_puesto_centro.

-- CreateTable
CREATE TABLE "bases_conocimiento" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "codigo" VARCHAR(20),
    "descripcion" TEXT,
    "fuente" TEXT,
    "color" VARCHAR(7),
    "orden" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "bases_conocimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niveles_base" (
    "id" TEXT NOT NULL,
    "base_conocimiento_id" TEXT NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "orden" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "niveles_base_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bases_conocimiento_nombre_key" ON "bases_conocimiento"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "bases_conocimiento_codigo_key" ON "bases_conocimiento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "niveles_base_base_conocimiento_id_nombre_key" ON "niveles_base"("base_conocimiento_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "niveles_base_base_conocimiento_id_orden_key" ON "niveles_base"("base_conocimiento_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "niveles_base_id_base_conocimiento_id_key" ON "niveles_base"("id", "base_conocimiento_id");

-- AddForeignKey
ALTER TABLE "niveles_base" ADD CONSTRAINT "niveles_base_base_conocimiento_id_fkey" FOREIGN KEY ("base_conocimiento_id") REFERENCES "bases_conocimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
