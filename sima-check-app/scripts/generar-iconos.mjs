import { mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const raiz = join(__dirname, '..')
const origen = join(raiz, 'public', 'SIMA_CHECK-logo.png')
const carpetaIcons = join(raiz, 'public', 'icons')
const fondoOrigen = join(raiz, 'public', 'SIMACHECK-FONDO.png')
const fondoDestino = join(raiz, 'public', 'SIMACHECK-FONDO.webp')

async function generarTransparente(destino, tamanio) {
  await sharp(origen)
    .resize(tamanio, tamanio, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(destino)
}

async function generarSobreFondoBlanco(destino, tamanio, proporcionLogo) {
  const logoTamanio = Math.round(tamanio * proporcionLogo)
  const logo = await sharp(origen)
    .resize(logoTamanio, logoTamanio, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: {
      width: tamanio,
      height: tamanio,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(destino)
}

async function generarFondoWebp() {
  await sharp(fondoOrigen).webp({ quality: 80 }).toFile(fondoDestino)
}

async function main() {
  await mkdir(carpetaIcons, { recursive: true })

  await generarTransparente(join(carpetaIcons, 'icon-192.png'), 192)
  await generarTransparente(join(carpetaIcons, 'icon-512.png'), 512)
  await generarSobreFondoBlanco(join(carpetaIcons, 'icon-maskable-512.png'), 512, 0.6)
  await generarSobreFondoBlanco(join(raiz, 'public', 'apple-touch-icon.png'), 180, 0.8)
  await generarFondoWebp()

  const { size } = await stat(fondoDestino)
  console.log('Íconos generados en public/icons/ y public/apple-touch-icon.png')
  console.log(`Fondo convertido a public/SIMACHECK-FONDO.webp (${(size / 1024).toFixed(1)} KB)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
