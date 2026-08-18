import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { dirname, resolve, sep } from 'node:path';

// Prefijo bajo el que se sirven los archivos (ver UploadsController).
export const UPLOADS_PREFIX = '/uploads/';

// Raíz del storage en disco. Vive acá para que UploadsController (fallback de
// content-type por extensión) y LocalDiskStorage (que escribe) no dupliquen
// el default.
export function uploadsDir(config: ConfigService): string {
  return resolve(config.get<string>('UPLOADS_DIR') ?? './uploads');
}

/** Lo que devuelve `leer()`: el contenido como stream más lo necesario para
 *  armar la respuesta HTTP. Es un **stream y no un Buffer** a propósito: el
 *  controller lo encadena a la respuesta sin que el archivo entero pase por la
 *  memoria del proceso. Con imágenes de hasta 2 MB y varias tablets rindiendo
 *  a la vez, bufferear sería cargar todo eso en RAM sin necesidad. */
export interface ArchivoLeido {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  // Identificador de versión del archivo, si el backend lo provee. Habilita
  // que el navegador revalide con If-None-Match en vez de bajarlo de nuevo.
  etag?: string;
}

/** Señala "esa clave no existe". El controller la traduce a 404; cualquier
 *  otro error es un 500 de verdad y no se confunde con un archivo faltante. */
export class ArchivoNoEncontrado extends Error {
  constructor(clave: string) {
    super(`No existe el archivo ${clave}`);
    this.name = 'ArchivoNoEncontrado';
  }
}

/**
 * Almacenamiento de archivos subidos.
 *
 * La API pública son **claves opacas** (`preguntas/<uuid>.png`), nunca rutas de
 * filesystem ni URLs absolutas: eso es lo que se guarda en la base y lo que
 * mantiene barata la migración a otra implementación (basta con otra clase
 * que cumpla esta interfaz, sin tocar schema, controllers ni frontend — ver
 * `R2Storage`).
 */
export abstract class StorageService {
  // Devuelve la clave con la que después se recupera o borra el archivo.
  abstract guardar(
    buffer: Buffer,
    carpeta: string,
    extension: string,
  ): Promise<string>;

  // Idempotente: que el archivo ya no exista es el resultado esperado.
  abstract borrar(clave: string): Promise<void>;

  /** Lanza `ArchivoNoEncontrado` si la clave no existe. */
  abstract leer(clave: string): Promise<ArchivoLeido>;
}

@Injectable()
export class LocalDiskStorage extends StorageService {
  private readonly raiz: string;

  constructor(config: ConfigService) {
    super();
    this.raiz = uploadsDir(config);
  }

  async guardar(
    buffer: Buffer,
    carpeta: string,
    extension: string,
  ): Promise<string> {
    // El nombre siempre es un uuid generado acá: el originalname del upload es
    // input del cliente y construir un path con él es path traversal.
    const clave = `${carpeta}/${randomUUID()}.${extension}`;
    const destino = this.rutaDe(clave);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, buffer);
    return clave;
  }

  async borrar(clave: string): Promise<void> {
    try {
      await unlink(this.rutaDe(clave));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async leer(clave: string): Promise<ArchivoLeido> {
    const ruta = this.rutaDe(clave);
    // El stat va antes de abrir el stream para poder distinguir "no existe"
    // (404) de un error de lectura real: un ENOENT emitido por el stream ya
    // viaja de forma asíncrona y llegaría con la respuesta empezada.
    let tam: number;
    try {
      tam = (await stat(ruta)).size;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ArchivoNoEncontrado(clave);
      }
      throw err;
    }
    return { stream: createReadStream(ruta), contentLength: tam };
  }

  // Defensa en profundidad: aunque el controller valida el formato de la clave,
  // ninguna clave debe poder resolver fuera de la raíz del storage.
  private rutaDe(clave: string): string {
    const destino = resolve(this.raiz, clave);
    if (!destino.startsWith(this.raiz + sep)) {
      throw new Error(`Clave de storage inválida: ${clave}`);
    }
    return destino;
  }
}
