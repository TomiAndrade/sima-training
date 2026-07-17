import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

// Prefijo bajo el que se sirven los archivos (ver useStaticAssets en main.ts).
export const UPLOADS_PREFIX = '/uploads/';

// Raíz del storage en disco. Vive acá para que main.ts (que monta el estático)
// y LocalDiskStorage (que escribe) no dupliquen el default.
export function uploadsDir(config: ConfigService): string {
  return resolve(config.get<string>('UPLOADS_DIR') ?? './uploads');
}

/**
 * Almacenamiento de archivos subidos.
 *
 * La API pública son **claves opacas** (`preguntas/<uuid>.png`), nunca rutas de
 * filesystem ni URLs absolutas: eso es lo que se guarda en la base y lo que
 * mantiene barata la migración a S3 (basta con otra implementación de esta
 * clase, sin tocar schema, controllers ni frontend).
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
