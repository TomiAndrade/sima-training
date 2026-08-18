import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  ArchivoLeido,
  ArchivoNoEncontrado,
  StorageService,
} from './storage.service';

// Content-Type por extensión. Chico y cerrado a propósito: las únicas
// extensiones que puede producir `guardar()` son las que valida
// formato-imagen.ts por magic bytes, así que no hace falta una tabla general
// de MIME types ni una dependencia para eso.
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export function contentTypeDe(clave: string): string | undefined {
  const ext = clave.split('.').pop()?.toLowerCase();
  return ext ? CONTENT_TYPES[ext] : undefined;
}

/**
 * Almacenamiento en Cloudflare R2 (API compatible con S3).
 *
 * Es la implementación obligatoria en cualquier deploy: el contenedor es
 * efímero, así que `LocalDiskStorage` pierde todas las imágenes en el primer
 * redeploy y deja la base con claves que no apuntan a nada.
 *
 * **Las claves son las mismas que en disco** (`preguntas/<uuid>.png`): lo único
 * que cambia es dónde vive el byte. Por eso migrar no toca ni el schema, ni los
 * controllers, ni los frontends — que era justamente el punto de que
 * `StorageService` fuera abstracto desde el principio.
 *
 * Se usa R2 y no S3 porque no cobra egreso: las imágenes se descargan una vez
 * por tablet y por evaluación, y ese es el único rubro que podía escalar mal.
 * La API es la de S3, así que mudarse a S3 sería cambiar configuración, no
 * código.
 */
@Injectable()
export class R2Storage extends StorageService {
  private readonly cliente: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    super();
    const accountId = requerido(config, 'R2_ACCOUNT_ID');
    this.bucket = requerido(config, 'R2_BUCKET');
    this.cliente = new S3Client({
      // R2 no tiene regiones al estilo AWS, pero el SDK exige una: 'auto' es
      // la que indica Cloudflare.
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requerido(config, 'R2_ACCESS_KEY_ID'),
        secretAccessKey: requerido(config, 'R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async guardar(
    buffer: Buffer,
    carpeta: string,
    extension: string,
  ): Promise<string> {
    // Mismo criterio que LocalDiskStorage: el nombre siempre es un uuid
    // generado acá. El originalname del upload es input del cliente.
    const clave = `${carpeta}/${randomUUID()}.${extension}`;
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: clave,
        Body: buffer,
        // Se estampa al subir para que R2 lo devuelva en cada lectura, en vez
        // de tener que deducirlo de la extensión en cada request.
        ContentType: contentTypeDe(clave),
      }),
    );
    return clave;
  }

  async borrar(clave: string): Promise<void> {
    // DeleteObject de S3 ya es idempotente: borrar algo que no existe
    // devuelve 204, no un error. Coincide con el contrato de la interfaz.
    await this.cliente.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }),
    );
  }

  async leer(clave: string): Promise<ArchivoLeido> {
    try {
      const r = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: clave }),
      );
      return {
        // En Node el Body de GetObject es un Readable; el tipo del SDK es más
        // amplio porque en el browser sería un ReadableStream web.
        stream: r.Body as Readable,
        contentType: r.ContentType ?? contentTypeDe(clave),
        contentLength: r.ContentLength,
        etag: r.ETag,
      };
    } catch (err) {
      if (esNoSuchKey(err)) throw new ArchivoNoEncontrado(clave);
      throw err;
    }
  }
}

// Se chequea el 404 además del nombre: R2 no siempre devuelve el `NoSuchKey`
// tipado que devuelve S3, y sin esto un archivo faltante se convertiría en un
// 500 en vez de un 404.
function esNoSuchKey(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}

// Falla al construir el módulo y no en la primera subida: un deploy sin
// credenciales tiene que morir al arrancar, no meses después cuando alguien
// suba la primera imagen y descubra que no se guardó en ningún lado.
function requerido(config: ConfigService, clave: string): string {
  const valor = config.get<string>(clave);
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${clave} (requerida con STORAGE_DRIVER=r2)`,
    );
  }
  return valor;
}
