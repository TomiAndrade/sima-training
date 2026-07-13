-- AlterTable
ALTER TABLE "modulo_versiones" ADD COLUMN     "activada_en" TIMESTAMP(3),
ADD COLUMN     "anio" INTEGER,
ADD COLUMN     "es_nueva_linea" BOOLEAN,
ADD COLUMN     "mayor" INTEGER,
ADD COLUMN     "menor" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "modulo_versiones_modulo_id_anio_mayor_menor_key" ON "modulo_versiones"("modulo_id", "anio", "mayor", "menor");
