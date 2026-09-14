// Cálculo del diff de auditoría: funciones PURAS, sin Prisma ni Nest — mismo
// patrón que asignaciones/vigencia.ts y sesiones/corregir.ts. Vive aparte del
// service para poder testear las reglas de "qué cuenta como cambio" sin una
// base de datos.

// Un campo cambiado es `{ antes, despues }` — salvo que esté en
// `camposRedactados` (ver calcularDiff): ahí es `{ redactado: true }`, sin
// ningún valor. Es el mismo objeto `diff`, no dos estructuras separadas: el
// frontend recorre una sola lista y decide cómo pintar cada entrada según si
// trae `redactado` o `antes`/`despues`.
export type CambioCampo = { antes: unknown; despues: unknown } | { redactado: true };
export type Diff = Record<string, CambioCampo>;

// Compara dos valores de UN campo. No es igualdad estricta a secas: hay tres
// reglas deliberadas, cada una pensada para que el log no se ensucie con
// ruido que a nadie le importa.
function sonIguales(a: unknown, b: unknown): boolean {
  // Regla 1: null y undefined son el MISMO valor. Que un campo pase de
  // ausente (undefined — no vino en el objeto) a NULL explícito no es un
  // cambio real de dato, es sólo una diferencia de representación entre dos
  // formas de decir "no hay valor".
  if (a === null || a === undefined) return b === null || b === undefined;

  // Regla 2: Date se compara por getTime(), no por identidad de objeto. Dos
  // Date que representan el mismo instante son el MISMO valor aunque sean
  // dos instancias distintas — con === estricto siempre marcarían "cambió",
  // porque cada lectura de la base crea un objeto Date nuevo.
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Regla 3 (el resto): igualdad ESTRICTA. Cubre el caso esperado —los
  // valores que entran acá son columnas escalares de una fila de base de
  // datos— y también objetos/arrays, que por diseño se comparan por
  // IDENTIDAD y no por contenido: esta función NO recorre estructuras
  // anidadas. Límite conocido, no un bug — si algún día entra un jsonb con
  // forma de objeto, dos objetos con el mismo contenido pero distinta
  // instancia van a marcar "cambió" aunque no haya cambiado nada.
  return a === b;
}

// Valor de UN campo en un lado (antes o despues) del cambio. `obj === null`
// es "no hay fila" (alta o baja) y el campo vale null explícito, no
// undefined — es lo que permite representar una alta como "todo pasó de
// null a su valor" en vez de "de ausente a su valor" (dos cosas distintas
// para sonIguales: undefined colapsa con null, pero ambos casos acá deben
// dar el mismo resultado, así que null es la representación elegida).
function valorDe(obj: Record<string, unknown> | null, campo: string): unknown {
  return obj === null ? null : obj[campo];
}

// antes/despues son null para representar "no hay fila" (alta o baja), no
// "fila vacía" — un objeto vacío `{}` sería una fila real sin columnas, que
// no es el caso que se modela acá.
//
// Un solo recorrido para alta/baja/update (a diferencia de la versión
// anterior, que tenía tres ramas): con `valorDe` los tres casos son la MISMA
// comparación, sólo cambia de qué lado viene el null. Efecto colateral
// bueno: una alta donde un campo nace en null (ej. `deletedAt` en `false`
// por default, pero nace null en otro caso) ya no genera una entrada
// `{ antes: null, despues: null }` — antes quedaba esa entrada sin sentido y
// el frontend la filtraba a mano (`antes !== despues`, ver
// HistorialUsuario.jsx); ahora `sonIguales` la descarta en el origen y el
// filtro del frontend pasa a ser una redundancia inofensiva, no algo de lo
// que dependa.
//
// `camposRedactados`: campos que SÍ importa saber que cambiaron pero cuyo
// valor no se quiere persistir (datos personales — ver docs/decisiones/
// auditoria.md). Pasan por la MISMA regla de `sonIguales` que cualquier otro
// campo (así que un campo redactado que no cambió, o que nunca tuvo valor —
// ej. un alta sin email — simplemente no genera entrada, ni siquiera
// `{ redactado: true }`: no hay nada que redactar si no hubo cambio real).
// La diferencia es sólo en qué se escribe cuando SÍ cambió: `{ redactado:
// true }` en vez de los valores.
export function calcularDiff(
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown> | null,
  camposIgnorados: string[] = [],
  camposRedactados: string[] = [],
): Diff {
  const ignorados = new Set(camposIgnorados);
  const redactados = new Set(camposRedactados);
  const diff: Diff = {};

  // Unión de claves de ambos lados — no sólo las de `antes` ni sólo las de
  // `despues`, para no perderse un campo que esté en uno y no en el otro.
  // `?? {}` es lo que deja expresar "no hay fila" sin romper Object.keys.
  const campos = new Set([
    ...Object.keys(antes ?? {}),
    ...Object.keys(despues ?? {}),
  ]);

  for (const campo of campos) {
    if (ignorados.has(campo)) continue;

    const valorAntes = valorDe(antes, campo);
    const valorDespues = valorDe(despues, campo);
    if (sonIguales(valorAntes, valorDespues)) continue;

    diff[campo] = redactados.has(campo)
      ? { redactado: true }
      : { antes: valorAntes, despues: valorDespues };
  }

  return diff;
}

export function hayCambios(diff: Diff): boolean {
  return Object.keys(diff).length > 0;
}
