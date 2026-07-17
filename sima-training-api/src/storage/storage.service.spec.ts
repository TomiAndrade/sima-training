import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { LocalDiskStorage } from './storage.service';

describe('LocalDiskStorage', () => {
  let raiz: string;
  let storage: LocalDiskStorage;

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), 'sima-storage-'));
    const config = { get: () => raiz } as unknown as ConfigService;
    storage = new LocalDiskStorage(config);
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it('guarda el archivo y devuelve una clave opaca con la carpeta y la extensión', async () => {
    const clave = await storage.guardar(
      Buffer.from('contenido'),
      'preguntas',
      'png',
    );

    expect(clave).toMatch(/^preguntas\/[0-9a-f-]{36}\.png$/);
    await expect(readFile(resolve(raiz, clave), 'utf8')).resolves.toBe(
      'contenido',
    );
  });

  it('genera una clave distinta por archivo, sin usar el nombre original', async () => {
    const a = await storage.guardar(Buffer.from('a'), 'preguntas', 'png');
    const b = await storage.guardar(Buffer.from('b'), 'preguntas', 'png');

    expect(a).not.toBe(b);
  });

  it('borra el archivo', async () => {
    const clave = await storage.guardar(Buffer.from('x'), 'preguntas', 'png');

    await storage.borrar(clave);

    await expect(stat(resolve(raiz, clave))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('borrar es idempotente: no falla si el archivo ya no está', async () => {
    const clave = await storage.guardar(Buffer.from('x'), 'preguntas', 'png');
    await storage.borrar(clave);

    await expect(storage.borrar(clave)).resolves.toBeUndefined();
  });

  it('rechaza una clave que escapa de la raíz del storage', async () => {
    await expect(storage.borrar('../../etc/passwd')).rejects.toThrow(
      /Clave de storage inválida/,
    );
  });
});
