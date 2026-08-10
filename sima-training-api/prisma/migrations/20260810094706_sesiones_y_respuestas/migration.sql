-- Story 4 del sprint 07-08: modelar la rendición de evaluaciones. Es la entidad que
-- no existía y que bloqueaba las aprobaciones, el informe de usuario, los vencimientos
-- y las estadísticas por base de conocimiento (ver docs/pendientes.md).
--
-- Cambio ADITIVO puro: dos tablas nuevas, cero backfill, ningún ALTER sobre tablas
-- existentes. Lo que cambia de significado —sin tocar el SQL— es
-- asignaciones.modulo_version_id, que hasta hoy nadie completaba: pasa a ser "con qué
-- versión se CUMPLIÓ esta obligación", y lo escribe SesionesService al aprobar.
--
-- Decisiones que el SQL no cuenta solo:
--
--   * NO hay unicidad sobre (usuario_id, modulo_version_id). Un reintento es
--     simplemente una fila más. Es la diferencia con `asignaciones`, donde el índice
--     parcial asignaciones_usuario_modulo_vigente deja a lo sumo UNA vigente por
--     (usuario, módulo). Acá "¿aprobó?" es EXISTS(aprobada) sobre cualquier versión
--     del módulo y "¿cuál fue el último intento?" se ordena por finalizada_en: las
--     dos derivadas, sin ningún flag `vigente` que mantener consistente.
--
--   * NO hay deleted_at. Borrar —aunque sea lógicamente— una rendición cambia en
--     silencio el historial de aprobación de una persona, y nada en el dominio la
--     borra. Si algún día hace falta anular un intento (sospecha de copia), va como
--     `anulada_at` al estilo de asignaciones.revocada_at, con modulosAprobados()
--     filtrándolo — no como un soft-delete. Tampoco hay updated_at/updated_by: una
--     sesión es un hecho histórico, mismo tratamiento que modulo_versiones.
--
--   * `respuestas` NO desnormaliza base_conocimiento_id ni nivel_id. Las estadísticas
--     por base se derivan por join (respuestas → preguntas → bases_conocimiento).
--     Copiarlas serviría sólo si una pregunta pudiera cambiar de base, y Pregunta no
--     tiene endpoint de edición (el único PATCH es el toggle de papelera).
--
--   * iniciada_en / finalizada_en son el reloj DEL DISPOSITIVO (los manda la tablet).
--     Sirven para medir cuánto duró la evaluación; NO son autoritativos — con el modo
--     offline el POST llega horas después y el reloj de la tablet puede estar
--     desfasado o mentido. La fecha oficial de la rendición a efectos de trazabilidad
--     ISO —y la que va a gobernar la vigencia de la Story 8— es created_at, que la
--     pone el servidor.
--
--   * umbral_aprobacion se congela en la fila en vez de leerse de una constante al
--     mostrar el resultado: si mañana se sube de 70 a 80, los certificados viejos
--     siguen diciendo lo que decían.
--
--   * correctas/total/porcentaje/aprobada los calcula SIEMPRE el backend a partir de
--     las respuestas crudas (src/sesiones/corregir.ts). La tablet corrige local para
--     mostrar el resultado al instante, pero esa corrección es una copia: es una
--     certificación de seguridad laboral, nadie se aprueba posteando aprobada: true.
--
-- Ojo con sesiones.asignacion_id: es la única relación OPCIONAL de este cambio, así
-- que su ON DELETE va explícito en el schema (Restrict). Con el default de Prisma
-- (SetNull) borrar una asignación desvincularía en silencio la sesión de la obligación
-- que vino a cumplir. Verificado abajo en el SQL emitido, que es donde se lee de
-- verdad — misma cautela que reglas_asignacion.puesto_id.
--
-- Y la de siempre: las dos tablas cuelgan de usuarios / modulo_versiones /
-- asignaciones / preguntas con FK RESTRICT, así que van PRIMERO en limpiar()
-- (prisma/seed.ts). Es la cuarta vez que esa cadena queda corta — el síntoma aparece
-- recién en la SEGUNDA corrida del seed.

-- CreateTable
CREATE TABLE "sesiones" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "modulo_version_id" TEXT NOT NULL,
    "asignacion_id" TEXT,
    "iniciada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_en" TIMESTAMP(3) NOT NULL,
    "correctas" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "umbral_aprobacion" INTEGER NOT NULL,
    "aprobada" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuestas" (
    "id" TEXT NOT NULL,
    "sesion_id" TEXT NOT NULL,
    "pregunta_id" TEXT NOT NULL,
    "respuesta_dada" TEXT,
    "correcta" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: es lo que consulta modulosAprobados() (usuario + aprobada).
CREATE INDEX "sesiones_usuario_id_aprobada_idx" ON "sesiones"("usuario_id", "aprobada");

-- CreateIndex
CREATE INDEX "sesiones_modulo_version_id_idx" ON "sesiones"("modulo_version_id");

-- CreateIndex: "qué preguntas se fallan más" + el join de estadísticas por base.
CREATE INDEX "respuestas_pregunta_id_idx" ON "respuestas"("pregunta_id");

-- CreateIndex: la misma pregunta no se contesta dos veces en el mismo intento. Sin
-- NULLs de por medio, así que lo expresa Prisma y NO hace falta un sexto índice
-- parcial escrito a mano (los cinco invisibles siguen siendo los de docs/pendientes.md).
CREATE UNIQUE INDEX "respuestas_sesion_id_pregunta_id_key" ON "respuestas"("sesion_id", "pregunta_id");

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_modulo_version_id_fkey" FOREIGN KEY ("modulo_version_id") REFERENCES "modulo_versiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: RESTRICT y no SET NULL — ver la nota de la cabecera.
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_asignacion_id_fkey" FOREIGN KEY ("asignacion_id") REFERENCES "asignaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_sesion_id_fkey" FOREIGN KEY ("sesion_id") REFERENCES "sesiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas" ADD CONSTRAINT "respuestas_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
