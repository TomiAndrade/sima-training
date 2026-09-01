/**
 * Da de alta a una persona con rol ADMINISTRADOR en la organización INTERNA.
 *
 * Existe porque el backoffice NO puede hacerlo: su alta manual está fijada a
 * `rol: ALUMNO` y no hay pantalla para crear cuentas de sistema (ver
 * CLAUDE.md → Administración/Usuarios). Y el `POST /usuarios` de la API está
 * detrás del guard global de Auth0, así que un script HTTP necesitaría un
 * token RS256 real de un admin que ya exista — problema del huevo y la
 * gallina justo cuando hay que crear el primero.
 *
 *   # dry-run (default: no escribe nada)
 *   npx ts-node scripts/crear-admin.ts --nombre Juan --apellido Perez \
 *     --dni 30111222 --email juan.perez@ejemplo.com
 *
 *   # escribir de verdad
 *   npx ts-node scripts/crear-admin.ts ... --ejecutar
 *
 * Los datos van por línea de comandos y NO hardcodeados en el archivo: nombre,
 * apellido y DNI son PII, y este archivo está versionado.
 *
 * Contra qué base escribe lo decide `DATABASE_URL` (la del `.env`, o una que
 * se pase en la línea del comando para apuntar a producción):
 *
 *   PowerShell:  $env:DATABASE_URL='postgresql://…'; npx ts-node scripts/crear-admin.ts … --ejecutar
 *   bash:        DATABASE_URL='postgresql://…' npx ts-node scripts/crear-admin.ts … --ejecutar
 *
 * El script imprime el host de la base antes de escribir, justamente para que
 * un dry-run sirva para confirmar que apunta a donde uno cree.
 *
 * ⚠️ ESTO SOLO CREA LA FILA `Usuario` + `Vinculacion`. Para que la persona
 * pueda entrar al backoffice hace falta ADEMÁS una cuenta en Auth0 con el
 * MISMO email: `JwtAuthGuard` nunca crea usuarios — busca por
 * `authProviderId` y, si no encuentra, linkea por email en el primer login.
 *
 * Reusa `UsuariosService.create()` (levanta un application context de Nest,
 * igual que el seed y que sembrar-rendiciones.ts) en vez de escribir un INSERT
 * crudo: así hereda la matriz tipo-de-organización ↔ rol, el revive por DNI y
 * el registro en el AuditLog. Lo único que no corre por esa vía es la
 * ValidationPipe global, que vive en main.ts y sólo aplica a la capa HTTP —
 * por eso las validaciones de formato de acá abajo.
 *
 * NO reusa scripts/archivo/crear-administradores.ts: ése se autenticaba con
 * `POST /auth/login`, que se eliminó en el cleanup post-Auth0 (Story 4).
 */
// Antes que nada: el script lee DATABASE_URL para decir a qué base apunta,
// y lo hace ANTES de levantar el contexto de Nest (o sea, antes de que
// ConfigModule cargue el .env por su cuenta). Ni dotenv ni ConfigModule pisan
// una variable que ya esté en el entorno, así que la DATABASE_URL de la línea
// del comando le gana a la del .env — que es justo lo que hace falta para
// apuntar a producción sin tocar el archivo.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { RolUsuario, TipoOrganizacion } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsuariosService } from '../src/usuarios/usuarios.service';

const ACTOR = 'script:crear-admin';
const ROL = RolUsuario.ADMINISTRADOR;

const ejecutar = process.argv.includes('--ejecutar');
const P = ejecutar ? '' : '[dry-run] ';

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i === -1) return undefined;
  const valor = process.argv[i + 1];
  if (!valor || valor.startsWith('--')) {
    throw new Error(`--${nombre} necesita un valor.`);
  }
  return valor.trim();
}

function exigirArg(nombre: string): string {
  const valor = arg(nombre);
  if (!valor) {
    throw new Error(
      `Falta --${nombre}. Los cuatro datos son obligatorios: --nombre, ` +
        '--apellido, --dni y --email (el email en particular, porque es lo que ' +
        'Auth0 usa para linkear la cuenta en el primer login).',
    );
  }
  return valor;
}

/** Igual que el @IsEmail() del DTO, en versión mínima: acá no corre la pipe. */
function assertEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`"${email}" no parece un email válido.`);
  }
}

/** Muestra host y base SIN usuario ni password: esto se imprime en pantalla. */
function describirBase(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`;
  } catch {
    return '(DATABASE_URL con formato no reconocido)';
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const nombre = exigirArg('nombre');
  const apellido = exigirArg('apellido');
  const dni = exigirArg('dni');
  const email = exigirArg('email');
  assertEmail(email);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta DATABASE_URL.');

  console.log(
    `${ejecutar ? '⚠ ESCRIBIENDO' : 'Dry-run'} contra ${describirBase(databaseUrl)}`,
  );
  console.log(`Persona: ${nombre} ${apellido} · DNI ${dni} · <${email}>`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const prisma = app.get(PrismaService);
    const usuarios = app.get(UsuariosService);

    // --- Organización: la única INTERNA, o la que se pase a mano -----------
    // El script no elige por vos si hay 0 o 2+: la matriz sólo permite
    // ADMINISTRADOR en una organización INTERNA.
    const organizacionId = arg('organizacion-id');
    const internas = await prisma.organizacion.findMany({
      where: { tipo: TipoOrganizacion.INTERNA },
    });

    let organizacion;
    if (organizacionId) {
      organizacion = internas.find((o) => o.id === Number(organizacionId));
      if (!organizacion) {
        throw new Error(
          `No hay ninguna organización INTERNA con id=${organizacionId}. ` +
            `Las que hay: ${internas.map((o) => `${o.id} (${o.nombre})`).join(', ') || 'ninguna'}.`,
        );
      }
    } else if (internas.length === 0) {
      throw new Error(
        'No hay ninguna organización tipo INTERNA en esta base. Sin eso no hay ' +
          'dónde asignar el rol ADMINISTRADOR (la matriz rol↔organización sólo ' +
          'lo permite en INTERNA).',
      );
    } else if (internas.length > 1) {
      console.error('\nHay más de una organización INTERNA:');
      for (const o of internas) console.error(`  id=${o.id}  ${o.nombre}`);
      throw new Error('Elegí cuál con --organizacion-id <n>.');
    } else {
      organizacion = internas[0];
    }

    if (!organizacion.activa) {
      console.warn(
        `⚠ La organización INTERNA ("${organizacion.nombre}") está inactiva. ` +
          'El backend no lo bloquea, pero conviene revisarlo — sigo igual.',
      );
    }
    console.log(
      `Organización: ${organizacion.nombre} (id=${organizacion.id}) · rol ${ROL}`,
    );

    // --- Email duplicado: aborta ------------------------------------------
    // `email` NO es único en el schema, así que la base acepta dos filas con
    // el mismo. Pero el guard de Auth0 hace findMany por email y, con más de
    // un candidato, RECHAZA el login en vez de elegir uno (ver
    // jwt-auth.guard.ts). O sea: crear un segundo usuario vivo con este email
    // no falla acá, deja a los DOS sin poder entrar al backoffice.
    const mismoEmail = await prisma.usuario.findMany({
      where: { email, deletedAt: null },
      select: { id: true, dni: true, nombre: true, apellido: true },
    });
    if (mismoEmail.length > 0) {
      console.error('\nYa hay usuarios vivos con ese email:');
      for (const u of mismoEmail) {
        console.error(`  id=${u.id}  ${u.nombre} ${u.apellido} (DNI ${u.dni})`);
      }
      throw new Error(
        'Crear otro con el mismo email dejaría a los dos sin poder loguearse ' +
          '(el guard de Auth0 rechaza el email ambiguo). Usá otro email, o ' +
          'promové a ADMINISTRADOR la vinculación de la persona que ya existe.',
      );
    }

    // --- DNI: existe vivo (aborta) o dado de baja (revive) -----------------
    const porDni = await prisma.usuario.findFirst({
      where: { dni },
      select: { id: true, deletedAt: true, nombre: true, apellido: true },
    });
    if (porDni && !porDni.deletedAt) {
      throw new Error(
        `El DNI ${dni} ya lo tiene ${porDni.nombre} ${porDni.apellido} ` +
          `(id=${porDni.id}), vivo en esta base. El alta no lo pisa: si es la ` +
          'misma persona, lo que hay que hacer es cambiarle el rol y el email ' +
          'a esa vinculación, no crear otra fila.',
      );
    }
    if (porDni?.deletedAt) {
      console.log(
        `↺ Hay una fila dada de baja con el DNI ${dni} (id=${porDni.id}). ` +
          'El alta la REVIVE con estos datos, conservando su id y su historial.',
      );
    }

    if (!ejecutar) {
      console.log(
        `\n${P}+ ${nombre} ${apellido} (${dni}) <${email}> como ${ROL}`,
      );
      console.log(
        '\nEsto fue un dry-run: no se escribió nada. Para escribir de verdad, ' +
          'agregá --ejecutar.',
      );
      return;
    }

    const creado = await usuarios.create(
      {
        nombre,
        apellido,
        dni,
        email,
        // Sin `pares`: un administrador es una cuenta de sistema, no alguien a
        // quien las reglas le deriven capacitaciones. Cero pares es una
        // cardinalidad válida.
        vinculacion: { organizacionId: organizacion.id, rol: ROL },
      },
      ACTOR,
    );

    console.log(`\n✓ Creado: id=${creado.id} · ${nombre} ${apellido} · ${ROL}`);
    console.log(
      '\nFalta el otro lado: dar de alta a esta persona en Auth0 con el MISMO ' +
        `email (<${email}>). El backend nunca crea usuarios — en su primer ` +
        'login el guard busca ese email y linkea la cuenta.',
    );
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
