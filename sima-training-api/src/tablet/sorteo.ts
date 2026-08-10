// Sorteo de n elementos sin reposición. Función PURA — sin Prisma, sin Nest, al
// estilo de sesiones/corregir.ts — para poder testear el contrato (n elementos,
// sin repetidos, subconjunto del original) sin mockear una base de datos ni
// stubear Math.random.
//
// En memoria (Fisher-Yates + slice) y no ORDER BY RANDOM() en la query: son
// pocas filas por versión (el pool de UNA versión de módulo, no todo el
// banco), así que no vale la pena bajar el sorteo a SQL.
export function sortear<T>(items: readonly T[], n: number): T[] {
  const mezclado = [...items];
  for (let i = mezclado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mezclado[i], mezclado[j]] = [mezclado[j], mezclado[i]];
  }
  return mezclado.slice(0, Math.min(n, mezclado.length));
}
