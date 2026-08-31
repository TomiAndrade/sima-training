// Migra el contenido de evaluación de SIMA CHECK de la base LOCAL a PRODUCCIÓN,
// escribiendo por HTTP contra la API deployada.
//
//   # dry-run (es el default: no escribe nada)
//   npx ts-node scripts/migrar-contenido-a-produccion.ts
//
//   # escribir de verdad
//   npx ts-node scripts/migrar-contenido-a-produccion.ts --ejecutar
//
// Variables de entorno (ninguna tiene default que apunte a producción):
//   MIGRACION_API_URL          URL de la API deployada. Sin esto, aborta.
//   MIGRACION_AUTH_USER        Credenciales para POST /auth/login. Sin default.
//   MIGRACION_AUTH_PASSWORD
//   DATABASE_URL               La base LOCAL, del .env de siempre. Sólo lectura.
//
// POR QUÉ HTTP Y NO pg_dump: las reglas que hacen válido a este contenido viven
// en los services, no en la base — resolverFuente (congela la fuente de la base
// en cada pregunta), el appendeo de `orden`, la validación de que la
// respuestaCorrecta esté entre las opciones, resolverCriterios() (que materializa
// el pool) y el cálculo del número AÑO.MAYOR.MENOR en activar(). Un dump las
// saltea todas. Además el storage cambia de driver (local → R2), así que las
// claves de imagen NO son portables: hay que resubir los archivos.
//
// UNA SOLA VÍA: el lado local es sólo SELECT (findMany/count, ni un create) y el
// lado producción es sólo HTTP. La guarda de `assertNoEsLocal` es lo que impide
// el accidente real — apuntar el escritor a localhost y duplicarse el banco.
//
// NUNCA BORRA NI PISA: sólo POST y un PUT. Si algo ya existe, se reusa o se
// saltea. Un módulo que ya está en producción se saltea entero (no se le crea
// borrador ni se le tocan los criterios).
//
// QUÉ MIGRA: bases + niveles, imágenes, preguntas activas asignadas a algún
// módulo que se migre, módulos con sus parámetros de examen, y el contenido de
// la versión ACTIVA de cada uno (criterios y pivots MANUAL).
// QUÉ NO: versiones BORRADOR y ARCHIVADO, preguntas en papelera, usuarios,
// organizaciones, vinculaciones, asignaciones, reglas y sesiones.

import 'dotenv/config';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient, Prisma, TipoPregunta } from '@prisma/client';

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const ejecutar = process.argv.includes('--ejecutar');
const ARCHIVO_ESTADO = resolve(__dirname, '.estado-migracion-produccion.json');

/**
 * Se prende recién cuando empieza a escribir. Un error de config (falta una env
 * var, la URL apunta a local, hay claves duplicadas) no creó nada, así que no
 * corresponde decirle a nadie que "retome desde donde quedó".
 */
let empezoAEscribir = false;

/** Prefijo de log: en dry-run todo va marcado, para que no queden dudas. */
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
 * La guarda que hace que el script sea de una sola vía. Invertirlo de verdad
 * (leer producción, escribir local) requeriría además credenciales de la base
 * de producción, que este script no usa nunca: la única forma de hacer daño es
 * apuntar el ESCRITOR a la base local, y es justo lo que esto corta.
 */
function assertNoEsLocal(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    throw new Error(
      `MIGRACION_API_URL apunta a ${host}. Este script escribe contenido nuevo y ` +
        'está pensado para correr contra producción; apuntarlo a la API local le ' +
        'duplicaría el banco a la base desde la que está leyendo.',
    );
  }
}

// ---------------------------------------------------------------------------
// Cliente HTTP contra producción — sólo GET, POST, PUT y PATCH. No hay DELETE.
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

  private async parse<T>(res: Response, contexto: string): Promise<T> {
    const texto = await res.text();
    const cuerpo = texto ? JSON.parse(texto) : null;
    if (!res.ok) {
      const msg = cuerpo?.message ?? `Error ${res.status}`;
      throw new Error(
        `${contexto} → ${res.status}: ${Array.isArray(msg) ? msg.join(', ') : msg}`,
      );
    }
    return cuerpo as T;
  }

  /** Lecturas: abiertas, sin token (la única protegida de la API es /sesiones/:id). */
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'GET' });
    return this.parse<T>(res, `GET ${path}`);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headersAuth({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res, `POST ${path}`);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headersAuth({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res, `PUT ${path}`);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.headersAuth({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    return this.parse<T>(res, `PATCH ${path}`);
  }

  /** POST /preguntas/imagen — multipart, campo `file`. Devuelve la clave nueva. */
  async subirImagen(nombreArchivo: string, bytes: Buffer): Promise<string> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)]), nombreArchivo);
    const res = await fetch(`${this.baseUrl}/preguntas/imagen`, {
      method: 'POST',
      headers: this.headersAuth(),
      body: form,
    });
    const cuerpo = await this.parse<{ imagen: string }>(
      res,
      `POST /preguntas/imagen (${nombreArchivo})`,
    );
    return cuerpo.imagen;
  }
}

// ---------------------------------------------------------------------------
// Archivo de estado — la vía REAL de idempotencia.
//
// Se reescribe después de cada creación, no al final: si el script se cae en la
// pregunta 140, la corrida siguiente retoma en la 141 sin resubir las imágenes
// ni recrear nada.
// ---------------------------------------------------------------------------

interface Estado {
  bases: Record<string, string>;
  niveles: Record<string, string>;
  preguntas: Record<string, string>;
  modulos: Record<string, string>;
  imagenes: Record<string, string>;
  /** Módulos ya activados, para no reintentar el PATCH sobre uno sin borrador. */
  modulosActivados: string[];
}

const estadoVacio = (): Estado => ({
  bases: {},
  niveles: {},
  preguntas: {},
  modulos: {},
  imagenes: {},
  modulosActivados: [],
});

async function cargarEstado(): Promise<{ estado: Estado; existia: boolean }> {
  try {
    const crudo = await readFile(ARCHIVO_ESTADO, 'utf8');
    return {
      estado: { ...estadoVacio(), ...JSON.parse(crudo) },
      existia: true,
    };
  } catch {
    return { estado: estadoVacio(), existia: false };
  }
}

async function guardarEstado(estado: Estado) {
  if (!ejecutar) return; // en dry-run no se toca el disco
  // Escritura atómica: un Ctrl-C justo acá no deja el archivo a medio escribir,
  // que es el único caso en que perderíamos el mapeo de una corrida entera.
  const tmp = `${ARCHIVO_ESTADO}.tmp`;
  await writeFile(tmp, JSON.stringify(estado, null, 2), 'utf8');
  await rename(tmp, ARCHIVO_ESTADO);
}

// ---------------------------------------------------------------------------
// La clave de contenido — capa 2, el fallback si se perdió el archivo de estado.
//
// Tiene que ser estable ENTRE ENTORNOS, así que se arma con nombres (no ids) y
// evita todo lo que sea una clave de storage.
//
// La rama de OPCIONES_IMAGEN descarta `respuestaCorrecta` porque ahí es una
// clave de storage (`preguntas/<uuid>.png`), distinta en cada entorno. Puede
// hacerlo porque esas preguntas ya tienen texto único. Las que SÍ repiten texto
// son OPCION_MULTIPLE con imagen de enunciado, y ahí la correcta es texto plano
// —estable— y es justo lo que las distingue.
//
// Nada de eso se da por sentado: `assertClavesUnicas` lo verifica en cada
// arranque y ABORTA si dos preguntas comparten clave.
// ---------------------------------------------------------------------------

const SEP = ''; // unit separator: no aparece en texto tipeado

interface DatosClave {
  texto: string;
  tipo: string;
  base: string | null;
  nivel: string | null;
  respuestaCorrecta: string | null;
}

function claveContenido(p: DatosClave): string {
  const partes = [p.texto, p.tipo, p.base ?? '', p.nivel ?? ''];
  if (p.tipo !== TipoPregunta.OPCIONES_IMAGEN) {
    partes.push(p.respuestaCorrecta ?? '');
  }
  return partes.join(SEP);
}

/** Aborta si dos preguntas locales comparten clave: sin esto el fallback elegiría mal. */
function assertClavesUnicas(preguntas: PreguntaLocal[]) {
  const porClave = new Map<string, PreguntaLocal[]>();
  for (const p of preguntas) {
    const k = claveContenido(datosClaveDe(p));
    porClave.set(k, [...(porClave.get(k) ?? []), p]);
  }

  const choques = [...porClave.values()].filter((g) => g.length > 1);
  if (choques.length === 0) return;

  console.error(
    `\n✗ ${choques.length} grupo(s) de preguntas comparten la clave de contenido.\n` +
      '  El archivo de estado sigue siendo válido, pero si se pierde no habría forma\n' +
      '  de saber cuál es cuál en producción. Antes que adivinar, esto aborta.\n',
  );
  for (const grupo of choques) {
    const p = grupo[0];
    console.error(
      `  "${p.texto.slice(0, 70)}" · ${p.tipo} · ` +
        `${p.base?.nombre ?? 'sin base'} / ${p.nivel?.nombre ?? 'sin nivel'}`,
    );
    for (const q of grupo) console.error(`      ${q.id}`);
  }
  throw new Error('Claves de contenido duplicadas; ver el detalle de arriba.');
}

// ---------------------------------------------------------------------------
// Lectura de la base local — SÓLO SELECT
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

type PreguntaLocal = Prisma.PreguntaGetPayload<{
  include: { base: true; nivel: true };
}>;

function datosClaveDe(p: PreguntaLocal): DatosClave {
  return {
    texto: p.texto,
    tipo: p.tipo,
    base: p.base?.nombre ?? null,
    nivel: p.nivel?.nombre ?? null,
    respuestaCorrecta: p.respuestaCorrecta,
  };
}

/** Las opciones son un array de strings en jsonb; null en las VERDADERO_FALSO. */
function opcionesDe(p: { opciones: Prisma.JsonValue }): string[] | null {
  if (!Array.isArray(p.opciones)) return null;
  return p.opciones.map(String);
}

async function leerLocal() {
  const bases = await prisma.baseConocimiento.findMany({
    include: { niveles: { orderBy: { orden: 'asc' } } },
    orderBy: { nombre: 'asc' },
  });

  // Sólo las versiones ACTIVO: las BORRADOR y ARCHIVADO quedan fuera de alcance.
  const versionesActivas = await prisma.moduloVersion.findMany({
    where: { estado: 'ACTIVO' },
    include: {
      modulo: true,
      criterios: { include: { base: true, nivel: true } },
      preguntas: {
        include: { pregunta: { include: { base: true, nivel: true } } },
        orderBy: { orden: 'asc' },
      },
    },
    orderBy: { modulo: { nombre: 'asc' } },
  });

  // "Sólo las preguntas asignadas a algún módulo que se migre, y sólo activas."
  // Se deduplican por id porque una pregunta puede estar en varios módulos.
  const preguntasPorId = new Map<string, PreguntaLocal>();
  for (const version of versionesActivas) {
    for (const pivot of version.preguntas) {
      if (pivot.pregunta.activa)
        preguntasPorId.set(pivot.preguntaId, pivot.pregunta);
    }
  }
  const preguntas = [...preguntasPorId.values()];

  return { bases, versionesActivas, preguntas };
}

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

const DIR_UPLOADS = resolve(
  __dirname,
  '..',
  process.env.UPLOADS_DIR ?? 'uploads',
);

/**
 * Junta las claves de storage que una pregunta referencia: la imagen del
 * enunciado y, si es OPCIONES_IMAGEN, sus opciones (que TAMBIÉN son claves).
 * Las rutas legacy del import de Excel viejo empiezan con '/' y no son claves
 * de storage — no hay archivo que subir, así que se reportan y abortan.
 */
function clavesDe(p: PreguntaLocal): string[] {
  const claves: string[] = [];
  if (p.imagen) claves.push(p.imagen);
  if (p.tipo === TipoPregunta.OPCIONES_IMAGEN) {
    claves.push(...(opcionesDe(p) ?? []));
    if (p.respuestaCorrecta) claves.push(p.respuestaCorrecta);
  }
  return claves;
}

function assertSinRutasLegacy(preguntas: PreguntaLocal[]) {
  const legacy = preguntas.flatMap((p) =>
    clavesDe(p)
      .filter((c) => !c.startsWith('preguntas/'))
      .map((c) => ({ id: p.id, clave: c })),
  );
  if (legacy.length === 0) return;

  console.error(
    `\n✗ ${legacy.length} imagen(es) con ruta legacy (no son claves de storage).\n` +
      '  Apuntan al public/ del frontend viejo, así que no hay archivo local que\n' +
      '  subir a R2 y la pregunta quedaría con la imagen rota en producción.\n',
  );
  for (const l of legacy) console.error(`  ${l.id}  ${l.clave}`);
  throw new Error('Hay imágenes con ruta legacy; ver el detalle de arriba.');
}

// ---------------------------------------------------------------------------
// Reconstrucción del mapeo desde producción — capa 2
// ---------------------------------------------------------------------------

interface BaseProd {
  id: string;
  nombre: string;
  niveles: { id: string; nombre: string }[];
}
interface PreguntaProd {
  id: string;
  texto: string;
  tipo: string;
  opciones: string[] | null;
  respuestaCorrecta: string | null;
  imagen: string | null;
  base: { nombre: string } | null;
  nivel: { nombre: string } | null;
}
interface ModuloProd {
  id: string;
  nombre: string;
  vigente: { estado: string } | null;
  borradorId: string | null;
}

/**
 * Recupera idLocal → idProd mirando lo que ya hay en producción. Sólo importa
 * cuando se perdió el archivo de estado; su trabajo es recuperar el mapeo o
 * ABORTAR, nunca adivinar.
 *
 * El mapa de imágenes se reconstruye POSICIONALMENTE desde las preguntas ya
 * migradas (local.opciones[i] ↔ prod.opciones[i]), que es exacto porque el
 * array se mandó en el orden local y jsonb lo conserva. Por eso no hace falta
 * hashear los bytes de /uploads: el mapa sólo se necesita para crear preguntas
 * que todavía no existen.
 */
async function reconciliar(
  api: ApiProduccion,
  estado: Estado,
  local: Awaited<ReturnType<typeof leerLocal>>,
) {
  const basesProd = await api.get<BaseProd[]>('/bases-conocimiento');
  const preguntasProd = await api.get<PreguntaProd[]>('/preguntas');
  const modulosProd = await api.get<ModuloProd[]>('/modulos');

  const baseProdPorNombre = new Map(basesProd.map((b) => [b.nombre, b]));
  for (const base of local.bases) {
    const prod = baseProdPorNombre.get(base.nombre);
    if (!prod) continue;
    estado.bases[base.id] = prod.id;

    const nivelProdPorNombre = new Map(prod.niveles.map((n) => [n.nombre, n]));
    for (const nivel of base.niveles) {
      const nProd = nivelProdPorNombre.get(nivel.nombre);
      if (nProd) estado.niveles[nivel.id] = nProd.id;
    }
  }

  // Índice por clave de contenido. Si una clave matchea más de una pregunta en
  // producción, no hay forma de elegir: aborta.
  const prodPorClave = new Map<string, PreguntaProd[]>();
  for (const p of preguntasProd) {
    const k = claveContenido({
      texto: p.texto,
      tipo: p.tipo,
      base: p.base?.nombre ?? null,
      nivel: p.nivel?.nombre ?? null,
      respuestaCorrecta: p.respuestaCorrecta,
    });
    prodPorClave.set(k, [...(prodPorClave.get(k) ?? []), p]);
  }

  for (const pregunta of local.preguntas) {
    const candidatos = prodPorClave.get(claveContenido(datosClaveDe(pregunta)));
    if (!candidatos) continue;
    if (candidatos.length > 1) {
      throw new Error(
        `La pregunta local ${pregunta.id} ("${pregunta.texto.slice(0, 60)}") ` +
          `matchea ${candidatos.length} preguntas en producción. Ambiguo: no se ` +
          'elige ninguna. Resolvé el duplicado en producción antes de seguir.',
      );
    }

    const prod = candidatos[0];
    estado.preguntas[pregunta.id] = prod.id;

    // Pareo posicional de las claves de imagen.
    if (pregunta.imagen && prod.imagen) {
      estado.imagenes[pregunta.imagen] = prod.imagen;
    }
    if (pregunta.tipo === TipoPregunta.OPCIONES_IMAGEN) {
      const localOpts = opcionesDe(pregunta) ?? [];
      const prodOpts = prod.opciones ?? [];
      if (localOpts.length !== prodOpts.length) {
        throw new Error(
          `La pregunta ${pregunta.id} tiene ${localOpts.length} opciones en local ` +
            `y ${prodOpts.length} en producción (${prod.id}). No se puede parear ` +
            'el mapa de imágenes sin adivinar.',
        );
      }
      localOpts.forEach((clave, i) => (estado.imagenes[clave] = prodOpts[i]));
    }
  }

  const moduloProdPorNombre = new Map(modulosProd.map((m) => [m.nombre, m]));
  for (const version of local.versionesActivas) {
    const prod = moduloProdPorNombre.get(version.modulo.nombre);
    if (!prod) continue;
    estado.modulos[version.modulo.id] = prod.id;
    // Ya publicado en producción: no hay que reactivarlo.
    if (
      prod.vigente?.estado === 'ACTIVO' &&
      !estado.modulosActivados.includes(version.modulo.id)
    ) {
      estado.modulosActivados.push(version.modulo.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

const resumen = {
  bases: { creadas: 0, reusadas: 0 },
  niveles: { creados: 0, reusados: 0 },
  imagenes: { subidas: 0, reusadas: 0 },
  preguntas: { creadas: 0, reusadas: 0 },
  modulos: { creados: 0, reusados: 0 },
  criterios: { aplicados: 0, salteados: 0 },
  pivotsManual: { asignados: 0, salteados: 0 },
  activaciones: { hechas: 0, salteadas: 0 },
};

// ---------------------------------------------------------------------------
// Migración
// ---------------------------------------------------------------------------

async function migrar(
  api: ApiProduccion,
  estado: Estado,
  local: Awaited<ReturnType<typeof leerLocal>>,
) {
  // --- 1. Bases y niveles ---------------------------------------------------
  console.log('\nBases de conocimiento');
  for (const base of local.bases) {
    if (estado.bases[base.id]) {
      console.log(`  = ${base.nombre}  (ya existía)`);
      resumen.bases.reusadas++;
    } else {
      console.log(`${P}  + ${base.nombre}`);
      if (ejecutar) {
        const creada = await api.post<{ id: string }>('/bases-conocimiento', {
          nombre: base.nombre,
          ...(base.codigo ? { codigo: base.codigo } : {}),
          ...(base.descripcion ? { descripcion: base.descripcion } : {}),
          ...(base.fuente ? { fuente: base.fuente } : {}),
          ...(base.color ? { color: base.color } : {}),
          // `orden` se omite: es null en las tres y el backend lo deja null.
        });
        estado.bases[base.id] = creada.id;
        await guardarEstado(estado);
      }
      resumen.bases.creadas++;
    }

    const baseProdId = estado.bases[base.id];
    // Los niveles van en orden de escala y SIN `orden`, para ejercitar el
    // appendeo del backend (mismo criterio que prisma/seed.ts).
    for (const nivel of base.niveles) {
      if (estado.niveles[nivel.id]) {
        console.log(`    = nivel ${nivel.nombre}  (ya existía)`);
        resumen.niveles.reusados++;
        continue;
      }
      console.log(`${P}    + nivel ${nivel.nombre}`);
      if (ejecutar) {
        const creado = await api.post<{ id: string }>(
          `/bases-conocimiento/${baseProdId}/niveles`,
          { nombre: nivel.nombre },
        );
        estado.niveles[nivel.id] = creado.id;
        await guardarEstado(estado);
      }
      resumen.niveles.creados++;
    }
  }

  // --- 2. Imágenes ----------------------------------------------------------
  // Las claves distintas, UNA sola vez cada una. La memoización es lo que
  // mantiene la respuestaCorrecta byte-idéntica a su opción dentro de cada
  // pregunta (mismo truco que crearSubidorDeImagenes en el seed).
  const clavesUnicas = [...new Set(local.preguntas.flatMap(clavesDe))].sort();

  console.log(`\nImágenes (${clavesUnicas.length} claves distintas)`);
  for (const clave of clavesUnicas) {
    if (estado.imagenes[clave]) {
      resumen.imagenes.reusadas++;
      continue;
    }
    console.log(`${P}  + ${clave}`);
    if (ejecutar) {
      const bytes = await readFile(resolve(DIR_UPLOADS, clave));
      const nueva = await api.subirImagen(clave.split('/').pop()!, bytes);
      estado.imagenes[clave] = nueva;
      await guardarEstado(estado);
    }
    resumen.imagenes.subidas++;
  }
  if (resumen.imagenes.reusadas > 0) {
    console.log(`  = ${resumen.imagenes.reusadas} ya estaban subidas`);
  }

  const traducir = (clave: string) => {
    const nueva = estado.imagenes[clave];
    if (!nueva && ejecutar) {
      throw new Error(`No hay clave de producción para la imagen ${clave}`);
    }
    return nueva ?? `<pendiente:${clave}>`;
  };

  // --- 3. Preguntas ---------------------------------------------------------
  console.log(`\nPreguntas (${local.preguntas.length})`);
  for (const pregunta of local.preguntas) {
    if (estado.preguntas[pregunta.id]) {
      resumen.preguntas.reusadas++;
      continue;
    }

    const esImagen = pregunta.tipo === TipoPregunta.OPCIONES_IMAGEN;
    const opciones = opcionesDe(pregunta);

    const cuerpo = {
      texto: pregunta.texto,
      tipo: pregunta.tipo,
      // Las VERDADERO_FALSO tienen opciones null en local: se omite el campo.
      ...(opciones
        ? { opciones: esImagen ? opciones.map(traducir) : opciones }
        : {}),
      ...(pregunta.respuestaCorrecta
        ? {
            respuestaCorrecta: esImagen
              ? traducir(pregunta.respuestaCorrecta)
              : pregunta.respuestaCorrecta,
          }
        : {}),
      ...(pregunta.imagen ? { imagen: traducir(pregunta.imagen) } : {}),
      ...(pregunta.puntajeMax != null
        ? { puntajeMax: pregunta.puntajeMax }
        : {}),
      ...(pregunta.baseConocimientoId
        ? { baseConocimientoId: estado.bases[pregunta.baseConocimientoId] }
        : {}),
      ...(pregunta.nivelId
        ? { nivelId: estado.niveles[pregunta.nivelId] }
        : {}),
      // `fuente` se OMITE a propósito: resolverFuente la copia de la base recién
      // creada y la congela, que es la regla que justifica ir por HTTP. En local
      // ninguna de las 202 diverge de su base, así que el resultado es el mismo.
    };

    console.log(`${P}  + ${pregunta.texto.slice(0, 68)}`);
    if (ejecutar) {
      const creada = await api.post<{ id: string }>('/preguntas', cuerpo);
      estado.preguntas[pregunta.id] = creada.id;
      await guardarEstado(estado);
    }
    resumen.preguntas.creadas++;
  }
  if (resumen.preguntas.reusadas > 0) {
    console.log(`  = ${resumen.preguntas.reusadas} ya existían`);
  }

  // --- 4. Módulos -----------------------------------------------------------
  console.log('\nMódulos');
  for (const version of local.versionesActivas) {
    const modulo = version.modulo;
    const yaExistia = Boolean(estado.modulos[modulo.id]);

    if (yaExistia) {
      // NUNCA PISA: un módulo que ya está en producción se saltea entero — no se
      // le crea borrador, no se le tocan los criterios, no se reactiva.
      console.log(`  = ${modulo.nombre}  (ya existía; se saltea entero)`);
      resumen.modulos.reusados++;
      resumen.criterios.salteados += version.criterios.length;
      resumen.pivotsManual.salteados += version.preguntas.filter(
        (p) => p.origen === 'MANUAL',
      ).length;
      resumen.activaciones.salteadas++;
      continue;
    }

    console.log(`${P}  + ${modulo.nombre}`);
    let moduloProdId = '';
    if (ejecutar) {
      const creado = await api.post<{ id: string }>('/modulos', {
        nombre: modulo.nombre,
        ...(modulo.descripcion ? { descripcion: modulo.descripcion } : {}),
        ...(modulo.vigenciaMeses != null
          ? { vigenciaMeses: modulo.vigenciaMeses }
          : {}),
        // Los cuatro parámetros de examen viajan inline y el backend los desvía
        // a la v1 BORRADOR que crea junto con el módulo.
        ...(version.preguntasPorExamen != null
          ? { preguntasPorExamen: version.preguntasPorExamen }
          : {}),
        ...(version.umbralAprobacion != null
          ? { umbralAprobacion: version.umbralAprobacion }
          : {}),
        ...(version.maxIntentos != null
          ? { maxIntentos: version.maxIntentos }
          : {}),
        ...(version.esperaEntreIntentosMinutos != null
          ? { esperaEntreIntentosMinutos: version.esperaEntreIntentosMinutos }
          : {}),
      });
      moduloProdId = creado.id;
      estado.modulos[modulo.id] = moduloProdId;
      await guardarEstado(estado);
    }
    resumen.modulos.creados++;

    // --- 4a. Pivots MANUAL, ANTES que los criterios -------------------------
    // El orden importa: resolverCriterios() saltea las preguntas que ya tienen
    // pivot MANUAL y las deja MANUAL. Al revés, una pregunta manual que además
    // matchea un criterio ya tendría pivot CRITERIO y el POST chocaría con un
    // 409 que voltea el batch entero (createMany no usa skipDuplicates).
    const manuales = version.preguntas
      .filter((p) => p.origen === 'MANUAL' && p.pregunta.activa)
      .sort((a, b) => a.orden - b.orden);

    if (manuales.length > 0) {
      console.log(`${P}    · ${manuales.length} pregunta(s) MANUAL`);
      if (ejecutar) {
        await api.post(
          `/modulos/${moduloProdId}/preguntas`,
          manuales.map((p) => ({
            preguntaId: estado.preguntas[p.preguntaId],
            orden: p.orden,
            obligatoria: p.obligatoria,
          })),
        );
      }
      resumen.pivotsManual.asignados += manuales.length;
    }

    // --- 4b. Criterios ------------------------------------------------------
    const criterios = version.criterios.map((c) => ({
      baseConocimientoId: estado.bases[c.baseConocimientoId],
      ...(c.nivelId ? { nivelId: estado.niveles[c.nivelId] } : {}),
    }));
    const esperadas = version.preguntas.filter(
      (p) => p.origen === 'CRITERIO',
    ).length;

    console.log(
      `${P}    · ${criterios.length} criterio(s) → ${esperadas} preguntas esperadas`,
    );
    if (ejecutar && criterios.length > 0) {
      const res = await api.put<{ resolucion: { agregadas: number } }>(
        `/modulos/${moduloProdId}/criterios`,
        { criterios },
      );
      if (res.resolucion.agregadas !== esperadas) {
        // No aborta: el módulo ya está creado y el estado guardado. Pero se
        // avisa fuerte, porque significa que el pool de producción no coincide
        // con el local y hay que mirarlo antes de dar la migración por buena.
        console.warn(
          `    ⚠ el criterio materializó ${res.resolucion.agregadas} preguntas, ` +
            `pero en local son ${esperadas}. Revisalo antes de publicar.`,
        );
      }
      resumen.criterios.aplicados += criterios.length;
    } else if (!ejecutar) {
      resumen.criterios.aplicados += criterios.length;
    }

    // --- 4c. Activar --------------------------------------------------------
    // Primera publicación del módulo en producción: body {} — `esNuevaLinea`
    // sólo hace falta cuando ya hay un ACTIVO del cual derivar el número.
    // Queda AÑO.01.00 con el año de HOY (activar() usa new Date().getFullYear()).
    console.log(`${P}    · activar`);
    if (ejecutar) {
      const v = await api.patch<{ anio: number; mayor: number; menor: number }>(
        `/modulos/${moduloProdId}/activar`,
        {},
      );
      console.log(
        `      publicado ${v.anio}.${String(v.mayor).padStart(2, '0')}.` +
          String(v.menor).padStart(2, '0'),
      );
      estado.modulosActivados.push(modulo.id);
      await guardarEstado(estado);
    }
    resumen.activaciones.hechas++;
  }
}

// ---------------------------------------------------------------------------

function imprimirResumen() {
  const filas: [string, string][] = [
    [
      'Bases',
      `${resumen.bases.creadas} creadas · ${resumen.bases.reusadas} reusadas`,
    ],
    [
      'Niveles',
      `${resumen.niveles.creados} creados · ${resumen.niveles.reusados} reusados`,
    ],
    [
      'Imágenes',
      `${resumen.imagenes.subidas} subidas · ${resumen.imagenes.reusadas} reusadas`,
    ],
    [
      'Preguntas',
      `${resumen.preguntas.creadas} creadas · ${resumen.preguntas.reusadas} reusadas`,
    ],
    [
      'Módulos',
      `${resumen.modulos.creados} creados · ${resumen.modulos.reusados} salteados`,
    ],
    [
      'Criterios',
      `${resumen.criterios.aplicados} aplicados · ${resumen.criterios.salteados} salteados`,
    ],
    [
      'Pivots MANUAL',
      `${resumen.pivotsManual.asignados} asignados · ${resumen.pivotsManual.salteados} salteados`,
    ],
    [
      'Activaciones',
      `${resumen.activaciones.hechas} hechas · ${resumen.activaciones.salteadas} salteadas`,
    ],
  ];

  console.log(`\n${'─'.repeat(60)}`);
  console.log(ejecutar ? 'Resumen' : 'Resumen (dry-run: no se escribió nada)');
  for (const [etiqueta, valor] of filas) {
    console.log(`  ${etiqueta.padEnd(16)} ${valor}`);
  }
  console.log('─'.repeat(60));

  if (!ejecutar) {
    console.log(
      '\nEsto fue un dry-run. Para escribir de verdad:\n' +
        '  npx ts-node scripts/migrar-contenido-a-produccion.ts --ejecutar',
    );
  }
}

async function main() {
  const apiUrl = exigirEnv('MIGRACION_API_URL').replace(/\/$/, '');
  const usuario = exigirEnv('MIGRACION_AUTH_USER');
  const password = exigirEnv('MIGRACION_AUTH_PASSWORD');
  assertNoEsLocal(apiUrl);

  console.log(`${ejecutar ? '⚠ ESCRIBIENDO' : 'Dry-run'} contra ${apiUrl}`);

  const local = await leerLocal();
  console.log(
    `Local: ${local.bases.length} bases · ` +
      `${local.bases.reduce((n, b) => n + b.niveles.length, 0)} niveles · ` +
      `${local.preguntas.length} preguntas · ` +
      `${local.versionesActivas.length} módulos con versión ACTIVA`,
  );

  // Guardas: las dos abortan antes de tocar producción.
  assertClavesUnicas(local.preguntas);
  assertSinRutasLegacy(local.preguntas);

  const api = new ApiProduccion(apiUrl);
  await api.login(usuario, password);

  const { estado, existia } = await cargarEstado();
  if (existia) {
    console.log('Archivo de estado encontrado: se retoma desde ahí.');
  } else {
    console.log(
      'Sin archivo de estado: se reconstruye el mapeo desde producción...',
    );
    await reconciliar(api, estado, local);
    await guardarEstado(estado);
  }

  empezoAEscribir = ejecutar;
  await migrar(api, estado, local);
  imprimirResumen();
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    if (empezoAEscribir) {
      console.error(
        '\nVolver a correrlo retoma desde donde quedó: el archivo de estado\n' +
          `(${ARCHIVO_ESTADO}) tiene lo que ya se creó.`,
      );
    }
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
