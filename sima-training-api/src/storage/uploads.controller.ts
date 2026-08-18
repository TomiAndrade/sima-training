import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ArchivoNoEncontrado, StorageService } from './storage.service';
import { contentTypeDe } from './r2.storage';

// Clave válida: `carpeta/uuid.ext`, que es lo único que produce `guardar()`.
// Se valida con una lista blanca en vez de buscar ".." — cualquier cosa que no
// matchee esto no es una clave que este backend haya emitido.
const CLAVE_VALIDA = /^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]+$/i;

/**
 * Sirve los archivos subidos bajo `/uploads/*`.
 *
 * Reemplaza al `useStaticAssets` que había en `main.ts`, que sólo sabía leer
 * del disco local. Ahora el archivo lo pide a `StorageService`, así que el
 * mismo endpoint funciona con el driver local y con R2 sin que cambie la URL:
 * `Pregunta.imagen` sigue guardando la misma clave opaca y los dos frontends
 * siguen pidiendo `/uploads/preguntas/<uuid>.png`.
 *
 * **Por qué el backend hace de intermediario en vez de exponer el bucket.**
 * Con el bucket público la tablet bajaría la imagen directo de Cloudflare —
 * más rápido y sin consumir ancho de banda del servidor. Se eligió lo otro
 * porque son fotos de instalaciones de clientes de Oil & Gas, y pasar por acá
 * deja el control de acceso en **un solo lugar** el día que haya que pedir un
 * token para verlas. Al revés (bucket público → privado) obliga a migrar las
 * URLs ya guardadas. El costo medido es despreciable a la escala del proyecto
 * (ver docs/decisiones/infraestructura.md).
 *
 * **Hoy la lectura es pública**, igual que con `useStaticAssets`: la app del
 * alumno pide las imágenes sin token. Esto no cambia eso — cambia dónde
 * habría que tocar para cambiarlo.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Get('*clave')
  // 1 año e `immutable`: la clave lleva un uuid y el contenido de una clave
  // nunca cambia (la imagen de una pregunta es inmutable, ver
  // decisiones/preguntas.md). Es lo que evita que cada tablet vuelva a bajar
  // las mismas imágenes en cada intento.
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async servir(
    @Param('clave') clave: string | string[],
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // El wildcard llega como array de segmentos ('preguntas', 'x.png').
    const ruta = Array.isArray(clave) ? clave.join('/') : clave;
    if (!CLAVE_VALIDA.test(ruta)) {
      throw new NotFoundException('Archivo no encontrado');
    }

    try {
      const archivo = await this.storage.leer(ruta);
      const contentType =
        archivo.contentType ?? contentTypeDe(ruta) ?? 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      if (archivo.contentLength !== undefined) {
        res.setHeader('Content-Length', archivo.contentLength);
      }
      if (archivo.etag) res.setHeader('ETag', archivo.etag);
      return new StreamableFile(archivo.stream);
    } catch (err) {
      if (err instanceof ArchivoNoEncontrado) {
        throw new NotFoundException('Archivo no encontrado');
      }
      throw err;
    }
  }
}
