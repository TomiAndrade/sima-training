-- CreateEnum
CREATE TYPE "TipoPregunta" AS ENUM ('VERDADERO_FALSO', 'OPCION_MULTIPLE', 'OPCIONES_IMAGEN', 'TEXTO_LIBRE');

-- CreateEnum
CREATE TYPE "CategoriaEtiqueta" AS ENUM ('TEMA', 'AREA', 'NORMA', 'ROL');

-- CreateEnum
CREATE TYPE "EstadoVersionModulo" AS ENUM ('BORRADOR', 'ACTIVO', 'ARCHIVADO');

-- CreateTable
CREATE TABLE "preguntas" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "tipo" "TipoPregunta" NOT NULL,
    "opciones" JSONB,
    "respuesta_correcta" TEXT,
    "imagen" TEXT,
    "puntaje_max" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "preguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etiquetas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "categoria" "CategoriaEtiqueta" NOT NULL,
    "color" VARCHAR(7),

    CONSTRAINT "etiquetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregunta_etiquetas" (
    "pregunta_id" TEXT NOT NULL,
    "etiqueta_id" TEXT NOT NULL,

    CONSTRAINT "pregunta_etiquetas_pkey" PRIMARY KEY ("pregunta_id","etiqueta_id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulo_versiones" (
    "id" TEXT NOT NULL,
    "modulo_id" TEXT NOT NULL,
    "numero_version" INTEGER NOT NULL,
    "estado" "EstadoVersionModulo" NOT NULL DEFAULT 'BORRADOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "modulo_versiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulo_version_preguntas" (
    "modulo_version_id" TEXT NOT NULL,
    "pregunta_id" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "modulo_version_preguntas_pkey" PRIMARY KEY ("modulo_version_id","pregunta_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_nombre_key" ON "etiquetas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "modulo_versiones_modulo_id_numero_version_key" ON "modulo_versiones"("modulo_id", "numero_version");

-- AddForeignKey
ALTER TABLE "pregunta_etiquetas" ADD CONSTRAINT "pregunta_etiquetas_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pregunta_etiquetas" ADD CONSTRAINT "pregunta_etiquetas_etiqueta_id_fkey" FOREIGN KEY ("etiqueta_id") REFERENCES "etiquetas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulo_versiones" ADD CONSTRAINT "modulo_versiones_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "modulos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulo_version_preguntas" ADD CONSTRAINT "modulo_version_preguntas_modulo_version_id_fkey" FOREIGN KEY ("modulo_version_id") REFERENCES "modulo_versiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulo_version_preguntas" ADD CONSTRAINT "modulo_version_preguntas_pregunta_id_fkey" FOREIGN KEY ("pregunta_id") REFERENCES "preguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
