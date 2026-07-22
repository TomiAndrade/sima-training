import { PrismaClient, TipoOrganizacion } from '@prisma/client';

const prisma = new PrismaClient();

// --- Datos base: solo estructura real, sin usuarios/organizaciones de prueba ---
// (los fixtures de usuarios/clientes copiados del prototipo se retiraron: Story 1
// "Limpiar usuarios mockeados" — quedaban persistidos en la base y ensuciaban las
// pruebas de las siguientes stories de usuarios).

// sima-check/data/training-modules.js (mock del backoffice) → Modulo real.
// Ids fijos: el backoffice los usa como `backendId` para poder llamar a
// /preguntas y /modulos/:id/preguntas mientras el Paso 1 (grid de módulos)
// sigue mockeado (se migra en un sprint futuro).
const MODULOS = [
  { id: '15e3d3b9-858c-44d2-8f8e-10b9be3b2c3a', nombre: 'SIMA Básico' },
  { id: '0372fc38-1092-4f3c-87d2-ae1be3bb2981', nombre: 'SIMA Intermedio' },
  { id: 'ca6d4904-af84-4691-bea9-692cc8e22084', nombre: 'SIMA Avanzado' },
  { id: '2d902814-e83a-4c8d-9f1e-5b1239ec8d76', nombre: 'Reglas de Oro Industria Petrolera' },
];

async function main() {
  // Idempotente: limpiar en orden de dependencia. Todas las FK son
  // ON DELETE RESTRICT, así que hay que ir de las hijas a las padres:
  // pares (puesto, centro) → vinculaciones → usuarios/organizaciones.
  // Borrar usuarios antes que sus vinculaciones falla en cuanto la base tenga
  // alguna (con la base vacía el orden no se notaba).
  await prisma.vinculacionPuestoCentro.deleteMany();
  await prisma.vinculacion.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.organizacion.deleteMany();

  // Idempotente: limpiar respetando la FK (modulo_version_preguntas → modulo_versiones/preguntas).
  await prisma.moduloVersionPregunta.deleteMany();
  await prisma.moduloVersion.deleteMany();
  await prisma.modulo.deleteMany();

  // 1) Organización interna de Ingeniería SIMA — estructura mínima real para
  // poder dar de alta administradores desde el backoffice (no es un fixture).
  await prisma.organizacion.create({
    data: {
      nombre: 'Ingeniería SIMA',
      tipo: TipoOrganizacion.INTERNA,
      activa: true,
      createdBy: 'seed',
    },
  });

  // 2) Módulos reales (uno por módulo mockeado del backoffice), con su
  // ModuloVersion v1 en BORRADOR para poder asignarles preguntas.
  for (const m of MODULOS) {
    await prisma.modulo.create({
      data: {
        id: m.id,
        nombre: m.nombre,
        createdBy: 'seed',
        versiones: { create: { numeroVersion: 1, createdBy: 'seed' } },
      },
    });
  }

  const orgs = await prisma.organizacion.count();
  const usuarios = await prisma.usuario.count();
  const modulos = await prisma.modulo.count();
  // eslint-disable-next-line no-console
  console.log(`Seed completo: ${orgs} organizaciones, ${usuarios} usuarios, ${modulos} módulos.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
