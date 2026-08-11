// Verifica que los links entre los archivos de docs/decisiones/ no queden colgados:
// que el archivo destino exista y que, si el link trae ancla (#seccion), esa ancla
// corresponda a un encabezado real de ese archivo.
//
// Uso:  node scripts/verificar-links-decisiones.mjs
// Sale con código 1 si encuentra algo roto (sirve en un hook o en CI).
//
// ---------------------------------------------------------------------------
// OJO CON EL SLUG. Replica el de GitHub, y tiene DOS trampas que no se ven
// leyendo el resultado — las dos se descubrieron rompiendo la verificación, no
// el documento. Si "simplificás" slug() con una regex más obvia, el script
// empieza a reportar como rotos links que están bien, y el arreglo natural
// (tocar los links) los rompe de verdad:
//
//   1. NO se quitan los acentos. GitHub deja `ó` en el slug: el ancla de
//      "La traducción" es #la-traducción, NO #la-traduccion. Normalizar con
//      NFD + quitar diacríticos parece más prolijo y es incorrecto.
//
//   2. NO se colapsan los espacios múltiples. GitHub reemplaza CADA espacio
//      por un guion, así que un título con un caracter que se elimina entre
//      dos espacios deja DOS guiones seguidos: "clave → URL" produce
//      "clave--url". Un `\s+` (con +) los colapsa a uno solo y da un ancla
//      que no existe.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'decisiones')

function slug(titulo) {
  return titulo
    .trim()
    .toLowerCase()
    // Quita puntuación conservando letras (incluidas las acentuadas), dígitos,
    // guiones bajos, espacios y guiones. Ver trampa 1.
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim()
    // Un guion por espacio, sin colapsar. Ver trampa 2.
    .replace(/\s/g, '-')
}

const archivos = readdirSync(DIR).filter((f) => f.endsWith('.md'))

const anclas = new Map(
  archivos.map((f) => [
    f,
    new Set(
      readFileSync(join(DIR, f), 'utf8')
        .split('\n')
        .filter((l) => l.startsWith('#'))
        .map((l) => slug(l.replace(/^#+/, ''))),
    ),
  ]),
)

const rotos = []
let total = 0

for (const f of archivos) {
  const texto = readFileSync(join(DIR, f), 'utf8')
  for (const [, destino, ancla] of texto.matchAll(/\]\(\.\/([\w.-]+\.md)(?:#([^)]+))?\)/g)) {
    total++
    if (!existsSync(join(DIR, destino))) {
      rotos.push(`${f} → ${destino} (el archivo no existe)`)
    } else if (ancla && !anclas.get(destino).has(ancla)) {
      rotos.push(`${f} → ${destino}#${ancla} (no hay un encabezado con esa ancla)`)
    }
  }
}

console.log(`${archivos.length} archivos · ${total} links internos · ${rotos.length} rotos`)
for (const r of rotos) console.log(`  ROTO  ${r}`)
process.exit(rotos.length ? 1 : 0)
