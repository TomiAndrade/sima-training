-- CreateEnum
CREATE TYPE "TipoOrganizacion" AS ENUM ('CLIENTE', 'SUBCONTRATISTA');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRADOR', 'COORDINADOR');

-- CreateTable
CREATE TABLE "organizaciones" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoOrganizacion" NOT NULL DEFAULT 'CLIENTE',
    "organizacion_padre_id" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "organizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "email" TEXT,
    "rol" "RolUsuario" NOT NULL DEFAULT 'COORDINADOR',
    "organizacion_id" INTEGER,
    "datos" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_dni_key" ON "usuarios"("dni");

-- AddForeignKey
ALTER TABLE "organizaciones" ADD CONSTRAINT "organizaciones_organizacion_padre_id_fkey" FOREIGN KEY ("organizacion_padre_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
