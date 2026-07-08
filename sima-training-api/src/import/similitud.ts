// Detección de preguntas duplicadas/parecidas — en memoria, sin dependencias.
// Funciones puras (fáciles de testear y de reemplazar por pg_trgm a futuro).

// Umbral de similitud a partir del cual dos preguntas se consideran "parecidas"
// (coeficiente de Dice, 0..1). Ajustable.
export const UMBRAL_PARECIDA = 0.7;

// Normaliza texto para comparar: minúsculas, sin acentos, sin puntuación,
// espacios colapsados. Pensado para enunciados en español.
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (acentos, diéresis)
    .replace(/[^a-z0-9\s]/g, ' ') // deja letras/números; el resto → espacio
    .replace(/\s+/g, ' ')
    .trim();
}

// Set de trigramas de caracteres del texto YA normalizado, con padding para
// dar peso a los bordes de las palabras.
export function trigramas(textoNormalizado: string): Set<string> {
  const s = `  ${textoNormalizado} `;
  const set = new Set<string>();
  for (let i = 0; i < s.length - 2; i++) {
    set.add(s.slice(i, i + 3));
  }
  return set;
}

// Coeficiente de Dice entre dos sets de trigramas: 2·|∩| / (|a|+|b|). 0..1.
export function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let interseccion = 0;
  for (const t of a) {
    if (b.has(t)) interseccion++;
  }
  return (2 * interseccion) / (a.size + b.size);
}

// Entrada de referencia (una pregunta del banco o una fila ya vista del archivo)
// con su texto normalizado y sus trigramas precalculados.
export interface RefSimilitud {
  preguntaId: string | null; // null si la referencia es otra fila del mismo Excel
  texto: string;
  norm: string;
  trigs: Set<string>;
}

export function toRef(
  texto: string,
  preguntaId: string | null = null,
): RefSimilitud {
  const norm = normalizar(texto);
  return { preguntaId, texto, norm, trigs: trigramas(norm) };
}

export type EstadoSimilitud = 'nueva' | 'duplicada' | 'parecida';

export interface ResultadoSimilitud {
  estado: EstadoSimilitud;
  similar?: { preguntaId: string | null; texto: string; score: number };
}

// Clasifica un texto contra un conjunto de referencias: duplicada (match exacto
// normalizado), parecida (mejor Dice ≥ umbral) o nueva.
export function clasificar(
  texto: string,
  refs: RefSimilitud[],
): ResultadoSimilitud {
  const norm = normalizar(texto);
  if (!norm) return { estado: 'nueva' };

  const exacta = refs.find((r) => r.norm === norm);
  if (exacta) {
    return {
      estado: 'duplicada',
      similar: { preguntaId: exacta.preguntaId, texto: exacta.texto, score: 1 },
    };
  }

  const trigs = trigramas(norm);
  let mejor: RefSimilitud | null = null;
  let mejorScore = 0;
  for (const r of refs) {
    const score = dice(trigs, r.trigs);
    if (score > mejorScore) {
      mejorScore = score;
      mejor = r;
    }
  }

  if (mejor && mejorScore >= UMBRAL_PARECIDA) {
    return {
      estado: 'parecida',
      similar: {
        preguntaId: mejor.preguntaId,
        texto: mejor.texto,
        score: Math.round(mejorScore * 100) / 100,
      },
    };
  }

  return { estado: 'nueva' };
}
