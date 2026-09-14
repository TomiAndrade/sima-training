import { readdirSync } from 'fs';
import { join, relative } from 'path';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

/**
 * El test que hace que un endpoint sin decorar falle en CI y no en
 * producción. No es un grep: recorre la METADATA que Nest realmente va a
 * leer en runtime, así que no se lo puede engañar escribiendo `@Roles` en un
 * comentario ni se le escapa un decorador puesto en el lugar equivocado.
 *
 * No levanta la app ni necesita base de datos: importa las clases de
 * controller y lee su metadata con Reflect. Bootear el AppModule habría
 * atado este test a tener Postgres corriendo, y un test de autorización que
 * no se puede correr sin infraestructura es un test que se termina salteando.
 *
 * Los controllers se descubren recorriendo el árbol de archivos, no con una
 * lista: un controller nuevo entra solo, que es justamente el caso que hay
 * que cubrir.
 */

const SRC = join(__dirname, '..');

function archivosDeControllers(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosDeControllers(ruta);
    return entrada.name.endsWith('.controller.ts') ? [ruta] : [];
  });
}

const VERBO: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
};

interface Ruta {
  verbo: string;
  path: string;
  controller: string;
  handler: string;
  archivo: string;
  roles: RolUsuario[] | undefined;
  publica: boolean;
}

function relevarRutas(): Ruta[] {
  const rutas: Ruta[] = [];

  for (const archivo of archivosDeControllers(SRC)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo = require(archivo) as Record<string, unknown>;

    for (const exportado of Object.values(modulo)) {
      if (typeof exportado !== 'function') continue;
      const clase = exportado as new (...args: never[]) => object;
      const prefijo = Reflect.getMetadata(PATH_METADATA, clase) as
        | string
        | undefined;
      if (prefijo === undefined) continue; // no es un @Controller

      const publicaEnClase = Reflect.getMetadata(IS_PUBLIC_KEY, clase) === true;
      const rolesEnClase = Reflect.getMetadata(ROLES_KEY, clase) as
        | RolUsuario[]
        | undefined;

      const proto = clase.prototype as Record<string, unknown>;
      for (const nombre of Object.getOwnPropertyNames(proto)) {
        if (nombre === 'constructor') continue;
        const handler = proto[nombre];
        if (typeof handler !== 'function') continue;

        const verbo = Reflect.getMetadata(METHOD_METADATA, handler) as
          | number
          | undefined;
        if (verbo === undefined) continue; // no es una ruta

        const sufijo = (Reflect.getMetadata(PATH_METADATA, handler) ??
          '') as string;
        const path = `/${[prefijo, sufijo]
          .filter((t) => t && t !== '/')
          .join('/')}`;

        rutas.push({
          verbo: VERBO[verbo] ?? String(verbo),
          path,
          controller: clase.name,
          handler: nombre,
          archivo: relative(SRC, archivo),
          roles:
            (Reflect.getMetadata(ROLES_KEY, handler) as
              | RolUsuario[]
              | undefined) ?? rolesEnClase,
          publica:
            Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
            publicaEnClase,
        });
      }
    }
  }

  return rutas.sort((a, b) =>
    `${a.path} ${a.verbo}`.localeCompare(`${b.path} ${b.verbo}`),
  );
}

describe('cobertura de autorización', () => {
  const rutas = relevarRutas();

  it('releva todas las rutas del proyecto', () => {
    // Si este número cambia es porque se agregó o sacó un endpoint. No es un
    // valor mágico: es la red que hace que los dos tests de abajo no pasen
    // en verde por estar mirando una lista vacía.
    expect(rutas).toHaveLength(73);
  });

  it('ninguna ruta queda sin @Roles() ni @Public()', () => {
    const huerfanas = rutas
      .filter((r) => !r.publica && (!r.roles || r.roles.length === 0))
      .map((r) => `${r.verbo} ${r.path} (${r.controller}.${r.handler})`);

    // Fail-closed: una ruta acá no queda "abierta", queda INACCESIBLE para
    // todos los roles. El mensaje nombra el handler para que arreglarlo sea
    // ir a una línea, no buscar.
    expect(huerfanas).toEqual([]);
  });

  it('ninguna ruta es @Public() y @Roles() a la vez', () => {
    // @Public() gana en el guard (early return), así que las dos juntas son
    // siempre un malentendido: alguien creyó estar restringiendo algo que en
    // realidad quedó abierto a cualquiera sin token.
    const ambiguas = rutas
      .filter((r) => r.publica && r.roles && r.roles.length > 0)
      .map((r) => `${r.verbo} ${r.path}`);

    expect(ambiguas).toEqual([]);
  });

  it('la matriz efectiva no cambió sin querer', () => {
    // Snapshot commiteado: un @Roles cambiado de lugar aparece en el diff del
    // PR en vez de pasar callado. Si el cambio es intencional, se actualiza
    // con `npx jest -u` y se revisa el diff.
    const matriz = rutas.map(
      (r) =>
        `${r.verbo.padEnd(6)} ${r.path.padEnd(45)} ${
          r.publica ? 'PUBLIC' : (r.roles ?? []).join(',')
        }`,
    );

    expect(matriz).toMatchSnapshot();
  });
});
