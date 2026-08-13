// Genera docs/demo/preguntas-medio-ambiente.xlsx, el archivo que se importa EN
// VIVO durante el paso 3 de la demo para mostrar la detección de preguntas
// duplicadas y parecidas.
//
//   npx ts-node scripts/demo/generar-excel-preguntas.ts
//
// El archivo está armado a propósito para que el preview muestre los tres
// badges. Contra el banco que sembró sembrar-contenido.ts:
//
//   6 filas NUEVAS      — preguntas que no están en el banco
//   2 filas DUPLICADAS  — copiadas TEXTUALMENTE de banco-demo.ts
//   2 filas PARECIDAS   — las mismas de siempre con un par de palabras cambiadas,
//                         que es exactamente cómo se cuela un duplicado real:
//                         alguien reescribe la pregunta sin saber que ya existe
//
// En el modal se elige "Medio Ambiente y Residuos" / "Básico" como destino: el
// Excel NO trae columnas de base ni de nivel, se estampan una sola vez para todo
// el archivo.

import { Workbook } from 'exceljs';
import * as path from 'path';
import { BASES_DEMO } from './banco-demo';

const DESTINO = path.resolve(
  __dirname,
  '../../..',
  'docs',
  'demo',
  'preguntas-medio-ambiente.xlsx',
);

// Los headers que espera COLUMN_MAP_PREGUNTAS (import.service.ts). Se escriben
// con acento y mayúsculas como los tipearía una persona: el backend los
// normaliza antes de mapear.
const HEADERS = [
  'Enunciado',
  'Tipo',
  'Opción A',
  'Opción B',
  'Opción C',
  'Opción D',
  'Respuesta correcta',
];

type FilaExcel = [string, string, string, string, string, string, string];

const vf = (texto: string, correcta: string): FilaExcel => [
  texto,
  'V/F',
  '',
  '',
  '',
  '',
  correcta,
];

const mc = (texto: string, ops: string[], correcta: string): FilaExcel => [
  texto,
  'Múltiple',
  ops[0] ?? '',
  ops[1] ?? '',
  ops[2] ?? '',
  ops[3] ?? '',
  correcta,
];

// Busca una pregunta ya sembrada por su comienzo, para copiarla textual sin
// tener que repetir el string acá (y que se desincronice si se edita el banco).
function delBanco(base: string, empiezaCon: string) {
  const b = BASES_DEMO.find((x) => x.nombre === base);
  const p = b?.niveles
    .flatMap((n) => n.preguntas)
    .find((q) => q.texto.startsWith(empiezaCon));
  if (!p) {
    throw new Error(
      `No hay ninguna pregunta de "${base}" que empiece con "${empiezaCon}". ` +
        'Se editó banco-demo.ts sin actualizar este script.',
    );
  }
  return p;
}

function construirFilas(): FilaExcel[] {
  // --- 2 duplicadas: texto idéntico al del banco -----------------------------
  const dup1 = delBanco('Medio Ambiente y Residuos', 'Un trapo embebido');
  const dup2 = delBanco('Medio Ambiente y Residuos', '¿Dónde se descarta un filtro');

  // --- 2 parecidas: la misma pregunta, reescrita -----------------------------
  // (el score real lo calcula el backend; salen bien arriba del umbral de 0.7)
  const par1 = 'Los contenedores de residuos deben estar correctamente identificados y tapados.';
  const par2 = '¿Qué se hace con un envase vacío de producto químico peligroso?';

  return [
    // 6 nuevas
    vf('Está prohibido lavar equipos sobre suelo natural sin contención.', 'Verdadero'),
    vf('El aceite usado puede volcarse en el pozo de purga si está frío.', 'Falso'),
    mc('¿Cada cuánto debe inspeccionarse un kit antiderrame?', [
      'Periódicamente y siempre después de usarlo',
      'Solamente cuando se usa',
      'Una vez al año',
      'No requiere inspección',
    ], 'Periódicamente y siempre después de usarlo'),
    mc('¿Qué se hace con las baterías de plomo fuera de uso?', [
      'Se entregan a un gestor habilitado como residuo peligroso',
      'Se descartan con la chatarra',
      'Se guardan indefinidamente en el pañol',
      'Se descartan como residuo común',
    ], 'Se entregan a un gestor habilitado como residuo peligroso'),
    mc('¿Qué hay que hacer antes de cargar combustible a un equipo en campo?', [
      'Colocar bandeja de contención bajo el punto de carga',
      'Apagar solamente las luces del equipo',
      'Avisar por radio al supervisor',
      'Nada, si la carga es menor a 20 litros',
    ], 'Colocar bandeja de contención bajo el punto de carga'),
    vf('Un derrame sobre suelo natural debe reportarse aunque sea de pocos litros.', 'Verdadero'),

    // 2 duplicadas (texto exacto del banco)
    vf(dup1.texto, dup1.respuestaCorrecta),
    mc(dup2.texto, dup2.opciones ?? [], dup2.respuestaCorrecta),

    // 2 parecidas (reescritas)
    vf(par1, 'Verdadero'),
    mc(par2, [
      'Se gestiona como residuo peligroso, no se reutiliza',
      'Se reutiliza para guardar agua',
      'Se descarta como residuo común',
      'Se entierra en el predio',
    ], 'Se gestiona como residuo peligroso, no se reutiliza'),
  ];
}

async function main() {
  const wb = new Workbook();
  const hoja = wb.addWorksheet('Preguntas');

  const header = hoja.getRow(1);
  HEADERS.forEach((h, i) => (header.getCell(i + 1).value = h));
  header.font = { bold: true };
  header.commit();

  const filas = construirFilas();
  filas.forEach((f, i) => {
    const row = hoja.getRow(i + 2);
    f.forEach((v, c) => (row.getCell(c + 1).value = v));
    row.commit();
  });

  hoja.columns.forEach((col, i) => {
    col.width = [70, 10, 30, 30, 30, 30, 30][i];
  });

  await wb.xlsx.writeFile(DESTINO);

  console.log(`${filas.length} filas escritas en:\n  ${DESTINO}`);
  console.log(
    '\nEsperado en el preview: 6 nuevas · 2 duplicadas · 2 parecidas.',
  );
  console.log(
    'Destino en el modal: base "Medio Ambiente y Residuos", nivel "Básico".',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
