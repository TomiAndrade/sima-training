// Detección del formato real de una imagen subida.
//
// Se mira el contenido (magic bytes), no el `originalname` ni el `mimetype`:
// los dos son input del cliente y se pueden mentir. La extensión con la que el
// archivo termina guardado sale de acá, nunca del nombre que mandó el browser.

export const FORMATOS_IMAGEN = ['png', 'jpg', 'webp'] as const;
export type FormatoImagen = (typeof FORMATOS_IMAGEN)[number];

// 2 MB. Son referencias visuales que se ven en una tablet, no fotos de archivo.
export const MAX_IMAGEN_SIZE = 2 * 1024 * 1024;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF = Buffer.from('RIFF', 'ascii');
const WEBP = Buffer.from('WEBP', 'ascii');

export function detectarFormatoImagen(buffer: Buffer): FormatoImagen | null {
  if (buffer.subarray(0, PNG.length).equals(PNG)) return 'png';
  if (buffer.subarray(0, JPG.length).equals(JPG)) return 'jpg';
  // WEBP: "RIFF" + 4 bytes de tamaño + "WEBP".
  if (
    buffer.subarray(0, 4).equals(RIFF) &&
    buffer.subarray(8, 12).equals(WEBP)
  ) {
    return 'webp';
  }
  return null;
}

// Formatos aceptados, para los mensajes de error del usuario.
export const FORMATOS_IMAGEN_LEGIBLE = 'PNG, JPG o WEBP';
