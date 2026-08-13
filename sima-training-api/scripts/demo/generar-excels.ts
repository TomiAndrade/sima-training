// Genera los dos .xlsx de nómina que se importan durante la demo, recortando el
// Excel real del cliente (docs/Puestos y listado de personal.xlsx).
//
//   npx ts-node scripts/demo/generar-excels.ts
//
// Lo único que hace es ELEGIR FILAS. La fila de encabezados se copia tal cual y
// las columnas no se tocan: el import ya entiende el formato del cliente
// (`apellido y nombre` partido por la primera coma, `puesto de trabajo`,
// `dependencia`), así que transformar el archivo sería inventar un problema que
// no existe — y encima haría que la demo no corra sobre el archivo real.
//
// La selección es DETERMINISTA: se recorren las filas en el orden del Excel y se
// toman las primeras que cumplen cada cupo. Sin random, sin fecha: dos corridas
// dan exactamente los mismos DNIs, que es lo que permite que el guion prometa
// números concretos en pantalla.

import { Workbook, Worksheet } from 'exceljs';
import * as path from 'path';
import { CENTROS_SEMILLA, PUESTOS_SEMILLA } from './catalogo-demo';

const RAIZ = path.resolve(__dirname, '../../..');
const ORIGEN = path.join(RAIZ, 'docs', 'Puestos y listado de personal.xlsx');
const DESTINO = path.join(RAIZ, 'docs', 'demo');

// Columnas de la hoja "Nómina de personal" (1-indexed, como exceljs).
const COL = { legajo: 1, dni: 2, apellidoNombre: 3, dependencia: 4, puesto: 5 };

interface Fila {
  indice: number; // fila en el Excel original, para poder rastrearla
  dni: string;
  nombre: string;
  dependencia: string;
  puesto: string;
}

// --- Similitud: la MISMA de src/import/similitud.ts ---------------------------
// Se reimplementa acá a propósito, en vez de importar el módulo de src/. Este
// script no levanta Nest y su trabajo es sólo *predecir* qué va a clasificar el
// backend para poder armar los cupos; el veredicto real lo da el endpoint de
// preview cuando corre la demo. Si alguna vez divergen, manda el backend.
const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const trigramas = (norm: string) => {
  const s = `  ${norm} `;
  const set = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
  return set;
};

const dice = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return (2 * inter) / (a.size + b.size);
};

type Estado = 'duplicada' | 'parecida' | 'nueva';

function clasificar(texto: string, catalogo: string[]): Estado {
  const norm = normalizar(texto);
  if (catalogo.some((c) => normalizar(c) === norm)) return 'duplicada';
  const trigs = trigramas(norm);
  let mejor = 0;
  for (const c of catalogo) {
    const score = dice(trigs, trigramas(normalizar(c)));
    if (score > mejor) mejor = score;
  }
  return mejor >= 0.7 ? 'parecida' : 'nueva';
}

// --- Lectura -----------------------------------------------------------------

function celda(hoja: Worksheet, fila: number, col: number): string {
  const v = hoja.getRow(fila).getCell(col).value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const obj = v as { text?: unknown; result?: unknown };
    if (obj.text !== undefined) return String(obj.text).trim();
    if (obj.result !== undefined) return String(obj.result).trim();
    return '';
  }
  return String(v).trim();
}

async function leerNomina(): Promise<{ hoja: Worksheet; filas: Fila[] }> {
  const wb = new Workbook();
  await wb.xlsx.readFile(ORIGEN);
  // worksheets[1] y no [0]: la primera hoja es "Listado de Puestos".
  // (El backend elige por header, acá alcanza con el índice porque el archivo
  // de origen es siempre este.)
  const hoja = wb.worksheets[1];
  const filas: Fila[] = [];
  for (let i = 2; i <= hoja.rowCount; i++) {
    const dni = celda(hoja, i, COL.dni);
    if (!dni) continue;
    filas.push({
      indice: i,
      dni,
      nombre: celda(hoja, i, COL.apellidoNombre),
      dependencia: celda(hoja, i, COL.dependencia),
      puesto: celda(hoja, i, COL.puesto),
    });
  }
  return { hoja, filas };
}

// --- Selección ---------------------------------------------------------------

// Toma las primeras `cantidad` filas que cumplen `criterio` y todavía no se
// usaron. Devuelve las que encontró (puede ser menos si no hay suficientes).
function tomar(
  filas: Fila[],
  usados: Set<string>,
  cantidad: number,
  criterio: (f: Fila) => boolean,
): Fila[] {
  const out: Fila[] = [];
  for (const f of filas) {
    if (out.length >= cantidad) break;
    if (usados.has(f.dni) || !criterio(f)) continue;
    usados.add(f.dni);
    out.push(f);
  }
  return out;
}

// Los 7 puestos ya cargados que trae la tanda A: uno por persona, todos
// distintos. Siete filas verdes de siete puestos distintos se lee mejor que
// siete personas del mismo puesto.
const TANDA_A_PUESTOS_CONOCIDOS = [
  'Operador de Planta',
  'Tareas Generales',
  'Recorredor',
  'Chofer flota pesada',
  'Soldador',
  'Electricista',
  'Mecánico de Campo',
];

// Los 3 puestos que todavía no existen. Son las únicas 3 decisiones de la tanda
// A, y las tres se resuelven igual: "Crear nuevo". Elegidos entre los puestos
// operativos de yacimiento (y no entre los administrativos que salían por orden
// de aparición) porque en una demo de capacitación industrial se entienden sin
// explicación. Quedan creados al confirmar, así que en la tanda B esas mismas
// personas ya dan "Duplicada": se ve que el sistema aprendió de la carga previa.
const TANDA_A_PUESTOS_NUEVOS = ['Baterista', 'Cañista', 'Gruista'];

// TANDA A — 10 personas. Es la carga inicial: se ve el caso feliz (el puesto ya
// está en el catálogo, badge verde, se asigna solo) y el caso de alta (el puesto
// no existe, badge "Nueva", se crea desde el modal). NO lleva ninguna
// "Parecida" a propósito: ese es el momento de la tanda B, y adelantarlo acá le
// saca el efecto.
function elegirTandaA(filas: Fila[]): Fila[] {
  const usados = new Set<string>();

  const conocidos = TANDA_A_PUESTOS_CONOCIDOS.flatMap((p) =>
    tomar(filas, usados, 1, (f) => f.puesto === p),
  );
  const nuevos = TANDA_A_PUESTOS_NUEVOS.flatMap((p) =>
    tomar(filas, usados, 1, (f) => f.puesto === p),
  );

  return [...conocidos, ...nuevos].sort((a, b) => a.indice - b.indice);
}

// Los puestos de la tanda B que van a exigir una decisión en el modal, elegidos
// UNO POR UNO.
//
// El modal agrupa por texto, no por fila: 5 personas con "Chofer flota pesada
// C/ Hidro" son UNA sola decisión. Pero cada texto distinto sin resolver es una
// parada — un `<select>` que hay que atender antes de poder importar. Tomar
// "todas las personas con puesto parecido" daba 20 decisiones de puesto, y con
// eso la demo deja de ser una demo y pasa a ser una sesión de data entry.
//
// Son 4 de puesto, y el modal suma 2 de centro ("1_ Administración" y
// "2_ Taller" contra los nombres limpios del catálogo): **6 decisiones en total**
// para las 60 filas. Cubren los tres badges y las tres acciones del resolver sin
// repetir el mismo aprendizaje seis veces.
//
// Quedaron afuera dos aciertos que también estaban buenos —"Coordinador de
// Servicio" (0.76) y "Control Documental QaQc" (0.90)— porque enseñan lo mismo
// que "Supervisor de Obra" y cada uno costaba una parada más.
const PUESTOS_A_RESOLVER: { puesto: string; personas: number; porque: string }[] = [
  {
    puesto: 'Chofer flota pesada C/ Hidro',
    personas: 5,
    porque:
      'FALSO POSITIVO (0.83 contra "Chofer flota pesada"). Son puestos distintos: ' +
      'uno maneja con hidrogrúa y el otro no. Se resuelve "Crear nuevo". ' +
      'Es el momento más importante de la demo — el software propone, no adivina.',
  },
  {
    puesto: 'Ayte. Tareas Generales',
    personas: 1,
    porque:
      'FALSO POSITIVO (0.82 contra "Tareas Generales"). Un ayudante no es el ' +
      'puesto pleno, y de eso depende qué capacitación le toca.',
  },
  {
    puesto: 'Supervisor de Obra',
    personas: 2,
    porque: 'ACIERTO (0.92 contra "Supervisor de Obras"). Falta una "s". Se acepta el sugerido.',
  },
  {
    puesto: 'Técnico HSE',
    personas: 4,
    porque:
      'NUEVA de verdad: no se parece a nada del catálogo (0.20). Se crea. ' +
      'Es el contraste que muestra que el badge "Nueva" significa algo.',
  },
];

// Variantes que el sistema resuelve SOLO, sin preguntar nada, porque normalizan
// igual que un puesto del catálogo (score 1.00 → badge "Duplicada"). Van sí o sí
// en la tanda B: son la contracara de los 6 de arriba y lo que hace evidente que
// el modal sólo interrumpe cuando de verdad hay una duda.
const VARIANTES_QUE_SE_RESUELVEN_SOLAS = [
  'Operador de  Planta', // doble espacio
  'Operador de planta', //  minúscula
  'Mecánico de campo', //   minúscula
];

// TANDA B — 60 personas. Incluye A completa (los 10 DNIs vuelven a venir, y el
// preview los marca en rojo como "ya existe un usuario activo"), más 50 elegidas
// para que el modal pida exactamente 6 decisiones y ninguna más.
function elegirTandaB(filas: Fila[], tandaA: Fila[]): Fila[] {
  const usados = new Set(tandaA.map((f) => f.dni));

  // El catálogo con el que se clasifica la tanda B NO es el semilla pelado: los
  // puestos nuevos de la tanda A quedan creados al confirmarla. Sin esto, la
  // proyección de este script no coincidiría con lo que muestra el preview real.
  const catalogoTrasA = [
    ...PUESTOS_SEMILLA,
    ...tandaA
      .map((f) => f.puesto)
      .filter((p) => clasificar(p, PUESTOS_SEMILLA) !== 'duplicada'),
  ];
  const clas = (f: Fila) => clasificar(f.puesto, catalogoTrasA);

  // 1) Las que exigen decisión, con el cupo exacto de cada grupo.
  const aResolver = PUESTOS_A_RESOLVER.flatMap((g) =>
    tomar(filas, usados, g.personas, (f) => f.puesto === g.puesto),
  );

  // 2) Las variantes que se resuelven solas.
  const variantes = VARIANTES_QUE_SE_RESUELVEN_SOLAS.flatMap((p) =>
    tomar(filas, usados, 99, (f) => f.puesto === p),
  );

  // 3) Relleno hasta 60 SÓLO con puestos que ya existen en el catálogo. Si acá
  // entrara cualquier fila, entrarían puestos nuevos y volverían las decisiones
  // de más que este diseño saca.
  const faltan = 60 - tandaA.length - aResolver.length - variantes.length;
  const exactas = tomar(filas, usados, faltan, (f) => clas(f) === 'duplicada');

  return [...tandaA, ...aResolver, ...variantes, ...exactas].sort(
    (a, b) => a.indice - b.indice,
  );
}

// --- Escritura ---------------------------------------------------------------

async function escribir(origen: Worksheet, filas: Fila[], archivo: string) {
  const wb = new Workbook();
  const hoja = wb.addWorksheet('Nómina de personal');

  // Encabezados TAL CUAL los del cliente (incluidos los espacios de más en
  // "  LEGAJO" y " APELLIDO Y NOMBRE"): el import los normaliza, y copiarlos sin
  // tocar es lo que prueba que no hace falta preparar el archivo a mano.
  const headerOriginal = origen.getRow(1);
  const header = hoja.getRow(1);
  for (let c = 1; c <= 5; c++) header.getCell(c).value = headerOriginal.getCell(c).value;
  header.font = { bold: true };
  header.commit();

  filas.forEach((f, i) => {
    const fila = hoja.getRow(i + 2);
    const orig = origen.getRow(f.indice);
    for (let c = 1; c <= 5; c++) fila.getCell(c).value = orig.getCell(c).value;
    fila.commit();
  });

  hoja.columns.forEach((col, i) => {
    col.width = [10, 12, 34, 24, 30][i];
  });

  const destino = path.join(DESTINO, archivo);
  await wb.xlsx.writeFile(destino);
  return destino;
}

// --- Reporte -----------------------------------------------------------------

function contar(filas: Fila[], catalogo: string[], campo: 'puesto' | 'dependencia') {
  const out: Record<Estado, number> = { duplicada: 0, parecida: 0, nueva: 0 };
  for (const f of filas) out[clasificar(f[campo], catalogo)]++;
  return out;
}

// Las decisiones que el modal va a pedir. Cuenta GRUPOS DE TEXTO y no filas,
// porque así los agrupa `claveGrupo()` en ImportUsuariosModal.jsx — y usando su
// misma normalización (trim + minúsculas + espacios colapsados). Una fila con
// match exacto no genera grupo: se resuelve sola.
function decisiones(filas: Fila[], catalogo: string[], campo: 'puesto' | 'dependencia') {
  const grupos = new Set<string>();
  for (const f of filas) {
    if (clasificar(f[campo], catalogo) === 'duplicada') continue;
    grupos.add(f[campo].trim().toLowerCase().replace(/\s+/g, ' '));
  }
  return grupos.size;
}

function reportar(
  nombre: string,
  filas: Fila[],
  catalogoPuestos: string[],
  yaEnBase: Set<string>,
) {
  const p = contar(filas, catalogoPuestos, 'puesto');
  const c = contar(filas, CENTROS_SEMILLA, 'dependencia');
  const dp = decisiones(filas, catalogoPuestos, 'puesto');
  const dc = decisiones(filas, CENTROS_SEMILLA, 'dependencia');
  const dup = filas.filter((f) => yaEnBase.has(f.dni)).length;

  console.log(`\n${nombre} — ${filas.length} filas`);
  console.log(`  DNI ya activo en base : ${dup}`);
  console.log(`  puesto  → duplicada ${p.duplicada} · parecida ${p.parecida} · nueva ${p.nueva}`);
  console.log(`  centro  → duplicada ${c.duplicada} · parecida ${c.parecida} · nueva ${c.nueva}`);
  console.log(`  DECISIONES en el modal: ${dp + dc}  (${dp} de puesto, ${dc} de centro)`);
}

async function main() {
  const { hoja, filas } = await leerNomina();
  console.log(`Origen: ${filas.length} personas en "${hoja.name}".`);

  const tandaA = elegirTandaA(filas);
  const tandaB = elegirTandaB(filas, tandaA);

  const a = await escribir(hoja, tandaA, 'tanda-a.xlsx');
  const b = await escribir(hoja, tandaB, 'tanda-b.xlsx');

  // Los puestos nuevos de A quedan creados al confirmarla, así que la tanda B se
  // reporta contra el catálogo ya ampliado — igual que la clasifica el backend.
  const catalogoTrasA = [
    ...PUESTOS_SEMILLA,
    ...tandaA
      .map((f) => f.puesto)
      .filter((p) => clasificar(p, PUESTOS_SEMILLA) !== 'duplicada'),
  ];

  reportar('tanda-a.xlsx', tandaA, PUESTOS_SEMILLA, new Set());
  reportar('tanda-b.xlsx', tandaB, catalogoTrasA, new Set(tandaA.map((f) => f.dni)));

  console.log('\nLo que hay que resolver en el modal de la tanda B:');
  for (const g of PUESTOS_A_RESOLVER) {
    console.log(`  · ${g.puesto}`);
    console.log(`      ${g.porque}`);
  }

  console.log(`\nEscritos:\n  ${a}\n  ${b}`);
  console.log(
    '\nEstos conteos son una PROYECCIÓN: el veredicto real lo da el preview del',
  );
  console.log('backend. Cómo medirlo end-to-end está en docs/demo-guion.md.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
