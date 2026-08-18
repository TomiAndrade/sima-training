import { NotFoundException, StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import { UploadsController } from './uploads.controller';
import { ArchivoNoEncontrado, StorageService } from './storage.service';

// Doble de Response: sólo interesa qué headers se setean.
function fakeRes() {
  const headers: Record<string, unknown> = {};
  return {
    headers,
    res: {
      setHeader: (k: string, v: unknown) => {
        headers[k] = v;
      },
    } as unknown as Response,
  };
}

function controller(storage: Partial<StorageService>) {
  return new UploadsController(storage as StorageService);
}

const archivo = (over: Record<string, unknown> = {}) => ({
  stream: Readable.from(['x']),
  contentType: 'image/png',
  contentLength: 70,
  etag: '"abc"',
  ...over,
});

describe('UploadsController', () => {
  it('sirve el archivo con content-type, length y etag del storage', async () => {
    const leer = jest.fn().mockResolvedValue(archivo());
    const { res, headers } = fakeRes();

    const out = await controller({ leer }).servir(['preguntas', 'a.png'], res);

    expect(leer).toHaveBeenCalledWith('preguntas/a.png');
    expect(out).toBeInstanceOf(StreamableFile);
    expect(headers['Content-Type']).toBe('image/png');
    expect(headers['Content-Length']).toBe(70);
    expect(headers['ETag']).toBe('"abc"');
  });

  it('deduce el content-type de la extensión si el storage no lo da', async () => {
    const leer = jest.fn().mockResolvedValue(archivo({ contentType: undefined }));
    const { res, headers } = fakeRes();

    await controller({ leer }).servir(['preguntas', 'a.webp'], res);

    expect(headers['Content-Type']).toBe('image/webp');
  });

  it('no manda Content-Length si el storage no lo sabe', async () => {
    const leer = jest
      .fn()
      .mockResolvedValue(archivo({ contentLength: undefined, etag: undefined }));
    const { res, headers } = fakeRes();

    await controller({ leer }).servir(['preguntas', 'a.png'], res);

    // Un Content-Length equivocado corta la respuesta a la mitad; omitirlo
    // deja que Express use chunked encoding, que siempre es correcto.
    expect(headers).not.toHaveProperty('Content-Length');
    expect(headers).not.toHaveProperty('ETag');
  });

  it('traduce ArchivoNoEncontrado a 404 y no a 500', async () => {
    const leer = jest.fn().mockRejectedValue(new ArchivoNoEncontrado('x'));
    const { res } = fakeRes();

    await expect(
      controller({ leer }).servir(['preguntas', 'a.png'], res),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propaga cualquier otro error: un fallo de red no es un 404', async () => {
    const leer = jest.fn().mockRejectedValue(new Error('R2 caído'));
    const { res } = fakeRes();

    await expect(
      controller({ leer }).servir(['preguntas', 'a.png'], res),
    ).rejects.toThrow('R2 caído');
  });

  // El controller es la única puerta a `leer()`, así que la clave se valida acá
  // con lista blanca. Ninguna de estas llega a tocar el storage.
  describe.each([
    ['..', ['..']],
    ['traversal simple', ['..', '..', '.env']],
    ['traversal con carpeta válida', ['preguntas', '..', '..', '.env']],
    ['sin extensión', ['preguntas', 'archivo']],
    ['sin carpeta', ['a.png']],
    ['tres niveles', ['a', 'b', 'c.png']],
  ])('rechaza %s', (_caso, segmentos) => {
    it('con 404 y sin llamar al storage', async () => {
      const leer = jest.fn();
      const { res } = fakeRes();

      await expect(
        controller({ leer }).servir(segmentos, res),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(leer).not.toHaveBeenCalled();
    });
  });
});
