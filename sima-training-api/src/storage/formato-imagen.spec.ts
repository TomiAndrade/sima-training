import { detectarFormatoImagen } from './formato-imagen';

// Cabeceras reales mínimas de cada formato.
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const webp = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);

describe('detectarFormatoImagen', () => {
  it('reconoce PNG, JPG y WEBP por sus magic bytes', () => {
    expect(detectarFormatoImagen(png)).toBe('png');
    expect(detectarFormatoImagen(jpg)).toBe('jpg');
    expect(detectarFormatoImagen(webp)).toBe('webp');
  });

  it('rechaza un archivo que no es imagen', () => {
    expect(detectarFormatoImagen(Buffer.from('no soy una imagen'))).toBeNull();
  });

  it('rechaza un RIFF que no es WEBP (ej. un .wav)', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE', 'ascii'),
    ]);
    expect(detectarFormatoImagen(wav)).toBeNull();
  });

  it('rechaza un buffer vacío o más corto que la cabecera', () => {
    expect(detectarFormatoImagen(Buffer.alloc(0))).toBeNull();
    expect(detectarFormatoImagen(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  it('no se deja engañar por la extensión: mira el contenido', () => {
    // Lo que subiría alguien renombrando un .txt a .png.
    expect(detectarFormatoImagen(Buffer.from('contenido de texto'))).toBeNull();
  });
});
