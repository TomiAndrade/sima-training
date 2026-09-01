-- AlterTable
ALTER TABLE "modulos" ADD COLUMN     "demo_publico" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sesiones_invitado" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "modulo_version_id" TEXT NOT NULL,
    "iniciada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_en" TIMESTAMP(3) NOT NULL,
    "correctas" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "porcentaje" INTEGER NOT NULL,
    "umbral_aprobacion" INTEGER NOT NULL,
    "aprobada" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesiones_invitado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respuestas_invitado" (
    "id" TEXT NOT NULL,
    "sesion_id" TEXT NOT NULL,
    "pregunta_id" TEXT NOT NULL,
    "respuesta_dada" TEXT,
    "correcta" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respuestas_invitado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sesiones_invitado_modulo_version_id_idx" ON "sesiones_invitado"("modulo_version_id");

-- CreateIndex
CREATE INDEX "sesiones_invitado_created_at_idx" ON "sesiones_invitado"("created_at");

-- CreateIndex
CREATE INDEX "respuestas_invitado_pregunta_id_idx" ON "respuestas_invitado"("pregunta_id");

-- CreateIndex
CREATE UNIQUE INDEX "respuestas_invitado_sesion_id_pregunta_id_key" ON "respuestas_invitado"("sesion_id", "pregunta_id");

-- AddForeignKey
ALTER TABLE "sesiones_invitado" ADD CONSTRAINT "sesiones_invitado_modulo_version_id_fkey" FOREIGN KEY ("modulo_version_id") REFERENCES "modulo_versiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_invitado" ADD CONSTRAINT "respuestas_invitado_sesion_id_fkey" FOREIGN KEY ("sesion_id") REFERENCES "sesiones_invitado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respuestas_invitado" ADD CONSTRAINT "respuestas_invitado_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

