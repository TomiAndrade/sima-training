// Cálculo del diff de auditoría: funciones PURAS, sin Prisma ni Nest — mismo
// patrón que asignaciones/vigencia.ts y sesiones/corregir.ts. Vive aparte del
// service para poder testear las reglas de "qué cuenta como cambio" sin una
// base de datos.

export type CambioCampo = { antes: unknown; despues: unknown };
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

// antes/despues son null para representar "no hay fila" (alta o baja), no
// "fila vacía" — un objeto vacío `{}` sería una fila real sin columnas, que
// no es el caso que se modela acá.
export function calcularDiff(
  antes: Record<string, unknown> | null,
  despues: Record<string, unknown> | null,
  camposIgnorados: string[] = [],
): Diff {
  const ignorados = new Set(camposIgnorados);
  const diff: Diff = {};

  // Alta: no había fila antes. Todos los campos de `despues` entran con
  // antes: null.
  if (antes === null) {
    for (const [campo, valor] of Object.entries(despues ?? {})) {
      if (ignorados.has(campo)) continue;
      diff[campo] = { antes: null, despues: valor };
    }
    return diff;
  }

  // Baja: no queda fila después. Todos los campos de `antes` entran con
  // despues: null.
  if (despues === null) {
    for (const [campo, valor] of Object.entries(antes)) {
      if (ignorados.has(campo)) continue;
      diff[campo] = { antes: valor, despues: null };
    }
    return diff;
  }

  // Update: sólo los campos que cambiaron. Se recorren las claves de AMBOS
  // objetos (vía Set) y no sólo las de `antes`, para no perderse un campo
  // que esté en uno y no en el otro.
  const campos = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  for (const campo of campos) {
    if (ignorados.has(campo)) continue;
    const valorAntes = antes[campo];
    const valorDespues = despues[campo];
    if (!sonIguales(valorAntes, valorDespues)) {
      diff[campo] = { antes: valorAntes, despues: valorDespues };
    }
  }
  return diff;
}

export function hayCambios(diff: Diff): boolean {
  return Object.keys(diff).length > 0;
}
