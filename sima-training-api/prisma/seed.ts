import { PrismaClient, RolUsuario, TipoOrganizacion } from '@prisma/client';

const prisma = new PrismaClient();

// --- Fixtures tomados del prototipo sima-training-backoffice ---

// core/data/companies.js (companyId del prototipo → se remapea al id real)
const COMPANIES = [
  { companyId: 1, nombre: 'YPF S.A.', activa: true },
  { companyId: 2, nombre: 'Pan American Energy', activa: true },
  { companyId: 3, nombre: 'TotalEnergies Argentina', activa: true },
  { companyId: 4, nombre: 'Pluspetrol S.A.', activa: false },
  { companyId: 5, nombre: 'Vista Energy', activa: true },
];

// core/data/users.js — el prototipo guarda un único `name` y `role`.
// Una sola entidad Usuario (decisión Sprint 1): se parte name → nombre/apellido
// y se generan DNIs de fixture (el prototipo no tenía DNI en estas cuentas).
const USERS = [
  { name: 'Carlos Méndez', role: 'administrador', companyId: 1, dni: '20111001' },
  { name: 'Patricia Herrera', role: 'administrador', companyId: 5, dni: '20111002' },
  { name: 'Laura Ríos', role: 'coordinador', companyId: 1, dni: '20111003' },
  { name: 'Sofía Vargas', role: 'coordinador', companyId: 2, dni: '20111004' },
  { name: 'Roberto Castillo', role: 'coordinador', companyId: 3, dni: '20111005' },
  { name: 'Andrés Peralta', role: 'coordinador', companyId: 3, dni: '20111006' },
  { name: 'Claudia Bustamante', role: 'coordinador', companyId: 4, dni: '20111007' },
  { name: 'Héctor Villanueva', role: 'coordinador', companyId: 5, dni: '20111008' },
];

const ROL_MAP: Record<string, RolUsuario> = {
  administrador: RolUsuario.ADMINISTRADOR,
  coordinador: RolUsuario.COORDINADOR,
};

function splitNombre(full: string): { nombre: string; apellido: string } {
  const parts = full.trim().split(/\s+/);
  const apellido = parts.length > 1 ? parts.pop()! : '';
  return { nombre: parts.join(' '), apellido };
}

async function main() {
  // Idempotente: limpiar respetando la FK (usuarios → organizaciones).
  await prisma.usuario.deleteMany();
  await prisma.organizacion.deleteMany();

  // 1) Organizaciones (clientes) — se guarda el mapa companyId → id real.
  const companyIdMap = new Map<number, number>();
  for (const c of COMPANIES) {
    const org = await prisma.organizacion.create({
      data: {
        nombre: c.nombre,
        tipo: TipoOrganizacion.CLIENTE,
        activa: c.activa,
        createdBy: 'seed',
      },
    });
    companyIdMap.set(c.companyId, org.id);
  }

  // 2) Un subcontratista colgando de un cliente (ejercita la FK self-referencial).
  const ypfId = companyIdMap.get(1)!;
  await prisma.organizacion.create({
    data: {
      nombre: 'Servicios Petroleros del Sur (subcontratista)',
      tipo: TipoOrganizacion.SUBCONTRATISTA,
      organizacionPadreId: ypfId,
      activa: true,
      createdBy: 'seed',
    },
  });

  // 3) Usuarios.
  for (const u of USERS) {
    const { nombre, apellido } = splitNombre(u.name);
    await prisma.usuario.create({
      data: {
        nombre,
        apellido,
        dni: u.dni,
        rol: ROL_MAP[u.role],
        organizacionId: companyIdMap.get(u.companyId) ?? null,
        createdBy: 'seed',
      },
    });
  }

  const orgs = await prisma.organizacion.count();
  const usuarios = await prisma.usuario.count();
  // eslint-disable-next-line no-console
  console.log(`Seed completo: ${orgs} organizaciones, ${usuarios} usuarios.`);
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
