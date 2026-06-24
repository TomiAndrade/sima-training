import { PrismaClient, RolUsuario, TipoOrganizacion } from '@prisma/client';

const prisma = new PrismaClient();

// --- Fixtures tomados del prototipo sima-training-backoffice ---

// core/data/clients.js (clientId del prototipo → se remapea al id real)
const CLIENTS = [
  { clientId: 1, nombre: 'YPF S.A.', activa: true },
  { clientId: 2, nombre: 'Pan American Energy', activa: true },
  { clientId: 3, nombre: 'TotalEnergies Argentina', activa: true },
  { clientId: 4, nombre: 'Pluspetrol S.A.', activa: false },
  { clientId: 5, nombre: 'Vista Energy', activa: true },
];

// core/data/users.js — el prototipo guarda un único `name` y `role`.
// Una sola entidad Usuario (decisión Sprint 1): se parte name → nombre/apellido
// y se generan DNIs de fixture (el prototipo no tenía DNI en estas cuentas).
// Administradores → organización interna Ingeniería SIMA (tipo INTERNA).
// Coordinadores → organización cliente (clientId del prototipo).
const USERS = [
  { name: 'Carlos Méndez',      role: 'administrador', clientId: null, dni: '20111001' },
  { name: 'Patricia Herrera',   role: 'administrador', clientId: null, dni: '20111002' },
  { name: 'Laura Ríos',         role: 'coordinador',   clientId: 1,   dni: '20111003' },
  { name: 'Sofía Vargas',       role: 'coordinador',   clientId: 2,   dni: '20111004' },
  { name: 'Roberto Castillo',   role: 'coordinador',   clientId: 3,   dni: '20111005' },
  { name: 'Andrés Peralta',     role: 'coordinador',   clientId: 3,   dni: '20111006' },
  { name: 'Claudia Bustamante', role: 'coordinador',   clientId: 4,   dni: '20111007' },
  { name: 'Héctor Villanueva',  role: 'coordinador',   clientId: 5,   dni: '20111008' },
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

  // 1) Organización interna de Ingeniería SIMA.
  const simaOrg = await prisma.organizacion.create({
    data: {
      nombre: 'Ingeniería SIMA',
      tipo: TipoOrganizacion.INTERNA,
      activa: true,
      createdBy: 'seed',
    },
  });

  // 2) Organizaciones cliente — se guarda el mapa clientId → id real.
  const clientIdMap = new Map<number, number>();
  for (const c of CLIENTS) {
    const org = await prisma.organizacion.create({
      data: {
        nombre: c.nombre,
        tipo: TipoOrganizacion.CLIENTE,
        activa: c.activa,
        createdBy: 'seed',
      },
    });
    clientIdMap.set(c.clientId, org.id);
  }

  // 3) Un subcontratista colgando de un cliente (ejercita la FK self-referencial).
  const ypfId = clientIdMap.get(1)!;
  await prisma.organizacion.create({
    data: {
      nombre: 'Servicios Petroleros del Sur (subcontratista)',
      tipo: TipoOrganizacion.SUBCONTRATISTA,
      organizacionPadreId: ypfId,
      activa: true,
      createdBy: 'seed',
    },
  });

  // 4) Usuarios: administradores → Ingeniería SIMA; coordinadores → su cliente.
  for (const u of USERS) {
    const { nombre, apellido } = splitNombre(u.name);
    const orgId =
      u.clientId === null
        ? simaOrg.id
        : (clientIdMap.get(u.clientId) ?? null);
    await prisma.usuario.create({
      data: {
        nombre,
        apellido,
        dni: u.dni,
        rol: ROL_MAP[u.role],
        organizacionId: orgId,
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
