// ═══════════════════════════════════════════════════════════════════════
// ARCHIVADO — NO RE-EJECUTAR.
//
// Creó los 3 usuarios ADMINISTRADOR en producción, antes de integrar Auth0,
// para que cada cuenta existiera de antemano y Auth0 pudiera linkearla por
// email en su primer login. Corrió una sola vez, el 2026-08-31, y cumplió
// su función — los 3 administradores ya existen en producción.
//
// Por qué no se re-corre:
//   - Se autenticaba con POST /auth/login usando MIGRACION_AUTH_USER /
//     MIGRACION_AUTH_PASSWORD contra AUTH_USER/AUTH_PASSWORD del backend.
//     Ese endpoint y esas variables YA NO EXISTEN (cleanup post-Auth0,
//     Story 4) — el script no puede ni loguearse tal cual está.
//   - Volver a correrlo contra los mismos 3 DNI es además redundante: el
//     alta de Usuario revive por DNI si ya existe, así que en el mejor
//     caso no haría nada nuevo.
//
// Se conserva tal cual corrió (no se toca ni se actualiza a la API actual)
// porque ya cumplió su propósito — ver la memoria del proyecto sobre no
// tocar scripts de producción ya verificados. Sirve como referencia de
// cómo se dieron de alta esas 3 cuentas, no como algo para correr de nuevo.
// ═══════════════════════════════════════════════════════════════════════

// Crea los 3 usuarios ADMINISTRADOR en PRODUCCIÓN, antes de integrar Auth0.
// Auth0 va a linkear cada cuenta por email en su primer login, así que el
// email de las 3 personas tiene que existir SÍ o SÍ.
//
//   # dry-run (es el default: no escribe nada)
//   npx ts-node scripts/crear-administradores.ts
//
//   # escribir de verdad
//   npx ts-node scripts/crear-administradores.ts --ejecutar
//
// Variables de entorno (las mismas del .env que usa migrar-contenido-a-
// produccion.ts — misma API, mismas credenciales):
//   MIGRACION_API_URL          URL de la API deployada. Sin esto, aborta.
//   MIGRACION_AUTH_USER        Credenciales para POST /auth/login.
//   MIGRACION_AUTH_PASSWORD
//
// NO TOCA NADA DE AUTH0, DEL GUARD NI DE AUTH_USER/AUTH_PASSWORD: sólo crea
// las 3 filas de Usuario/Vinculacion. El linkeo por email es un paso
// posterior, ajeno a este script.
//
// Este archivo COPIA (no importa) el cliente HTTP de
// migrar-contenido-a-produccion.ts a propósito: ese script ya corrió contra
// producción y cumplió su función, así que no se toca para extraer un
// helper compartido. Si aparece un tercer script contra producción, ahí se
// justifica extraer scripts/lib/api-produccion.ts.

import 'dotenv/config';

// ---------------------------------------------------------------------------
// Los datos de las 3 personas — COMPLETAR antes de correr.
// ---------------------------------------------------------------------------

interface DatosAdministrador {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
}

const ADMINISTRADORES: DatosAdministrador[] = [
  { nombre: '', apellido: '', dni: '', email: '' }, // TODO completar
  { nombre: '', apellido: '', dni: '', email: '' }, // TODO completar
];

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const ejecutar = process.argv.includes('--ejecutar');
const P = ejecutar ? '' : '[dry-run] ';

function exigirEnv(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. No tiene default a propósito: ` +
        'este script escribe en producción y la URL y las credenciales tienen ' +
        'que ser explícitas.',
    );
  }
  return valor;
}

/**
 * Misma guarda que migrar-contenido-a-produccion.ts: si MIGRACION_API_URL
 * apunta a local, aborta — este script sólo tiene sentido contra producción.
 */
function assertNoEsLocal(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    throw new Error(
      `MIGRACION_API_URL apunta a ${host}. Este script crea usuarios y está ` +
        'pensado para correr contra producción.',
    );
  }
}

// ---------------------------------------------------------------------------
// Cliente HTTP contra producción — sólo lo que este script necesita.
// ---------------------------------------------------------------------------

class ApiProduccion {
  private token: string | null = null;

  constructor(private readonly baseUrl: string) {}

  async login(usuario: string, password: string) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password }),
    });
    if (!res.ok) {
      throw new Error(
        `Login falló (${res.status}). Revisá MIGRACION_AUTH_USER y ` +
          'MIGRACION_AUTH_PASSWORD contra las variables AUTH_USER/AUTH_PASSWORD ' +
          'del servicio en Render.',
      );
    }
    this.token = ((await res.json()) as { access_token: string }).access_token;
  }

  private headersAuth(extra: Record<string, string> = {}) {
    if (!this.token) throw new Error('No hay token: falta llamar a login()');
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  private async parse<T>(
    res: Response,
    contexto: string,
  ): Promise<
    { ok: true; body: T } | { ok: false; status: number; mensaje: string }
  > {
    const texto = await res.text();
    const cuerpo = texto ? JSON.parse(texto) : null;
    if (!res.ok) {
      const msg = cuerpo?.message ?? `Error ${res.status}`;
      return {
        ok: false,
        status: res.status,
        mensaje: `${contexto} → ${res.status}: ${Array.isArray(msg) ? msg.join(', ') : msg}`,
      };
    }
    return { ok: true, body: cuerpo as T };
  }

  /** Lectura abierta, sin token. */
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'GET' });
    const r = await this.parse<T>(res, `GET ${path}`);
    if (!r.ok) throw new Error(r.mensaje);
    return r.body;
  }

  /**
   * POST autenticado que NO tira en caso de error — devuelve el status y el
   * mensaje para que el caller decida (necesario para distinguir el 409 de
   * "ya existe" de cualquier otro fallo real).
   */
  async post<T>(
    path: string,
    body: unknown,
  ): Promise<
    { ok: true; body: T } | { ok: false; status: number; mensaje: string }
  > {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headersAuth({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res, `POST ${path}`);
  }
}

// ---------------------------------------------------------------------------
// Validación local — antes de cualquier request.
// ---------------------------------------------------------------------------

function assertDatosCompletos(personas: DatosAdministrador[]) {
  const incompletas = personas
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.nombre || !p.apellido || !p.dni || !p.email);

  if (incompletas.length === 0) return;

  console.error(
    `\n✗ Faltan datos en ${incompletas.length} de las ${personas.length} personas ` +
      'de ADMINISTRADORES. Los cuatro campos son obligatorios — el email en ' +
      'particular, porque es lo que Auth0 usa para linkear la cuenta en el ' +
      'primer login.\n',
  );
  for (const { p, i } of incompletas) {
    const faltantes = (['nombre', 'apellido', 'dni', 'email'] as const).filter(
      (campo) => !p[campo],
    );
    console.error(`  posición ${i}: falta ${faltantes.join(', ')}`);
  }
  throw new Error('Completá ADMINISTRADORES antes de correr el script.');
}

// ---------------------------------------------------------------------------
// Organización — resuelve la INTERNA, sin adivinar si hay 0 o 2+.
// ---------------------------------------------------------------------------

interface OrganizacionProd {
  id: number;
  nombre: string;
  tipo: string;
  activa: boolean;
}

async function resolverOrganizacionInterna(
  api: ApiProduccion,
): Promise<OrganizacionProd> {
  const todas = await api.get<OrganizacionProd[]>('/organizaciones');
  const internas = todas.filter((o) => o.tipo === 'INTERNA');

  if (internas.length === 0) {
    throw new Error(
      'No hay ninguna organización tipo INTERNA en producción. Sin eso no hay ' +
        'dónde asignar el rol ADMINISTRADOR (la matriz rol↔organización sólo lo ' +
        'permite en INTERNA).',
    );
  }
  if (internas.length > 1) {
    console.error(
      '\nHay más de una organización INTERNA; el script no elige por vos:\n',
    );
    for (const o of internas) console.error(`  id=${o.id}  ${o.nombre}`);
    throw new Error('Resolvé cuál usar y ajustá el script antes de correrlo.');
  }

  const org = internas[0];
  if (!org.activa) {
    console.warn(
      `⚠ La organización INTERNA ("${org.nombre}") está inactiva. El backend no ` +
        'lo bloquea, pero conviene revisarlo — sigo igual.',
    );
  }
  return org;
}

// ---------------------------------------------------------------------------

async function main() {
  const apiUrl = exigirEnv('MIGRACION_API_URL').replace(/\/$/, '');
  const usuario = exigirEnv('MIGRACION_AUTH_USER');
  const password = exigirEnv('MIGRACION_AUTH_PASSWORD');
  assertNoEsLocal(apiUrl);

  assertDatosCompletos(ADMINISTRADORES);

  console.log(`${ejecutar ? '⚠ ESCRIBIENDO' : 'Dry-run'} contra ${apiUrl}`);

  const api = new ApiProduccion(apiUrl);
  await api.login(usuario, password);

  const organizacion = await resolverOrganizacionInterna(api);
  console.log(`Organización: ${organizacion.nombre} (id=${organizacion.id})`);

  let creados = 0;
  let yaExistian = 0;

  console.log('\nAdministradores');
  for (const persona of ADMINISTRADORES) {
    const etiqueta = `${persona.nombre} ${persona.apellido} (${persona.dni})`;

    if (!ejecutar) {
      console.log(`${P}  + ${etiqueta}  <${persona.email}>`);
      creados++;
      continue;
    }

    const res = await api.post<{ id: number }>('/usuarios', {
      nombre: persona.nombre,
      apellido: persona.apellido,
      dni: persona.dni,
      email: persona.email,
      vinculacion: { organizacionId: organizacion.id, rol: 'ADMINISTRADOR' },
    });

    if (res.ok) {
      console.log(`  + ${etiqueta}  id=${res.body.id}`);
      creados++;
    } else if (res.status === 409) {
      console.log(`  = ${etiqueta}  (ya existe, se saltea)`);
      yaExistian++;
    } else {
      // Cualquier otro status es algo real para revisar a mano — con sólo 3
      // usuarios no vale la pena seguir intentando los demás a ciegas.
      throw new Error(res.mensaje);
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(ejecutar ? 'Resumen' : 'Resumen (dry-run: no se escribió nada)');
  console.log(`  Creados       ${creados}`);
  console.log(`  Ya existían   ${yaExistian}`);
  console.log('─'.repeat(50));

  if (!ejecutar) {
    console.log(
      '\nEsto fue un dry-run. Para escribir de verdad:\n' +
        '  npx ts-node scripts/crear-administradores.ts --ejecutar',
    );
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
