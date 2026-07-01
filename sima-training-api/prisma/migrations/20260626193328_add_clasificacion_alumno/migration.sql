-- CreateEnum
CREATE TYPE "ClasificacionAlumno" AS ENUM ('SIMA', 'SUBCONTRATISTA', 'CLIENTE', 'INVITADO');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "clasificacion" "ClasificacionAlumno";
