import { ConfigService } from '@nestjs/config';
import { contentTypeDe, R2Storage } from './r2.storage';
import { ArchivoNoEncontrado } from './storage.service';

const config = (vals: Record<string, string | undefined>) =>
  ({ get: (k: string) => vals[k] }) as unknown as ConfigService;

const COMPLETO = {
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'bucket',
};

// El cliente S3 se reemplaza por un doble: estos tests son sobre la lógica de
// R2Storage (armado de claves, traducción de errores), no sobre el SDK.
function conCliente(send: jest.Mock) {
  const storage = new R2Storage(config(COMPLETO));
  (storage as unknown as { cliente: { send: jest.Mock } }).cliente = { send };
  return storage;
}

describe('contentTypeDe', () => {
  it.each([
    ['preguntas/a.png', 'image/png'],
    ['preguntas/a.jpg', 'image/jpeg'],
    ['preguntas/a.jpeg', 'image/jpeg'],
    ['preguntas/a.webp', 'image/webp'],
    ['preguntas/a.PNG', 'image/png'],
  ])('%s → %s', (clave, esperado) => {
    expect(contentTypeDe(clave)).toBe(esperado);
  });

  it('devuelve undefined para una extensión que guardar() no puede producir', () => {
    expect(contentTypeDe('preguntas/a.exe')).toBeUndefined();
    expect(contentTypeDe('preguntas/sinextension')).toBeUndefined();
  });
});

describe('R2Storage', () => {
  describe('configuración', () => {
    it.each(Object.keys(COMPLETO))('falla al construir si falta %s', (falta) => {
      const vals = { ...COMPLETO, [falta]: undefined };
      // Al construir y no en la primera subida: un deploy mal configurado
      // tiene que morir al arrancar, no meses después.
      expect(() => new R2Storage(config(vals))).toThrow(falta);
    });

    it('construye con las cuatro variables', () => {
      expect(() => new R2Storage(config(COMPLETO))).not.toThrow();
    });
  });

  describe('guardar', () => {
    it('genera la clave con uuid y devuelve carpeta/uuid.ext', async () => {
      const send = jest.fn().mockResolvedValue({});
      const clave = await conCliente(send).guardar(Buffer.from('x'), 'preguntas', 'png');

      expect(clave).toMatch(/^preguntas\/[0-9a-f-]{36}\.png$/);
      const input = send.mock.calls[0][0].input;
      expect(input.Key).toBe(clave);
      expect(input.Bucket).toBe('bucket');
      // Se estampa al subir para que R2 lo devuelva en cada lectura.
      expect(input.ContentType).toBe('image/png');
    });

    it('nunca reusa la clave entre dos llamadas', async () => {
      const send = jest.fn().mockResolvedValue({});
      const storage = conCliente(send);
      const a = await storage.guardar(Buffer.from('x'), 'preguntas', 'png');
      const b = await storage.guardar(Buffer.from('x'), 'preguntas', 'png');
      expect(a).not.toBe(b);
    });
  });

  describe('leer', () => {
    it('devuelve stream, contentType, length y etag', async () => {
      const send = jest.fn().mockResolvedValue({
        Body: 'stream',
        ContentType: 'image/png',
        ContentLength: 70,
        ETag: '"abc"',
      });

      const r = await conCliente(send).leer('preguntas/a.png');

      expect(r).toEqual({
        stream: 'stream',
        contentType: 'image/png',
        contentLength: 70,
        etag: '"abc"',
      });
    });

    it('cae a la extensión si R2 no devuelve ContentType', async () => {
      const send = jest.fn().mockResolvedValue({ Body: 's' });
      const r = await conCliente(send).leer('preguntas/a.webp');
      expect(r.contentType).toBe('image/webp');
    });

    it('traduce NoSuchKey a ArchivoNoEncontrado', async () => {
      const err = Object.assign(new Error('nope'), { name: 'NoSuchKey' });
      const send = jest.fn().mockRejectedValue(err);

      await expect(conCliente(send).leer('preguntas/a.png')).rejects.toBeInstanceOf(
        ArchivoNoEncontrado,
      );
    });

    it('traduce un 404 sin nombre tipado: R2 no siempre manda NoSuchKey', async () => {
      const err = Object.assign(new Error('nope'), {
        $metadata: { httpStatusCode: 404 },
      });
      const send = jest.fn().mockRejectedValue(err);

      await expect(conCliente(send).leer('preguntas/a.png')).rejects.toBeInstanceOf(
        ArchivoNoEncontrado,
      );
    });

    it('NO traduce otros errores: un 500 de R2 no es un archivo faltante', async () => {
      const err = Object.assign(new Error('boom'), {
        $metadata: { httpStatusCode: 500 },
      });
      const send = jest.fn().mockRejectedValue(err);

      await expect(conCliente(send).leer('preguntas/a.png')).rejects.toThrow('boom');
    });
  });

  describe('borrar', () => {
    it('manda DeleteObject con la clave', async () => {
      const send = jest.fn().mockResolvedValue({});
      await conCliente(send).borrar('preguntas/a.png');

      expect(send.mock.calls[0][0].input).toEqual({
        Bucket: 'bucket',
        Key: 'preguntas/a.png',
      });
    });

    it('no falla si el archivo no existe: DeleteObject ya es idempotente', async () => {
      const send = jest.fn().mockResolvedValue({});
      await expect(conCliente(send).borrar('preguntas/fantasma.png')).resolves.toBeUndefined();
    });
  });
});
