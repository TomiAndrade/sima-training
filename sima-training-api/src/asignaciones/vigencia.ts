// Cálculo de vigencia de una aprobación: funciones PURAS, sin Prisma ni Nest —
// mismo patrón que sesiones/corregir.ts. Vive aparte del service para poder
// testear los bordes de vencimiento sin fake timers ni una base de datos.
//
// Por qué la firma de calcularVencimiento recibe una sola fecha de aprobación
// y no una lista de sesiones: resolver "cuál es la ÚLTIMA sesión APROBADA de
// este módulo" es una consulta (ordenar por Sesion.createdAt, filtrar
// aprobada: true) — eso es el paso 2 de esta story, en AsignacionesService.
// Acá solo entra el resultado de esa consulta ya resuelto, para no mezclar
// I/O con el cálculo.
//
// Por qué `vigenciaMeses` se lee VIVO de Modulo en vez de congelarse en la
// Sesion, a diferencia de `umbralAprobacion` (ver corregir.ts): el umbral
// decide un VEREDICTO ya emitido — cambiarlo reescribiría certificados ya
// entregados. La vigencia decide algo distinto: CUÁNDO vuelve a existir una
// obligación FUTURA de rendir de nuevo. Si HSE achica la vigencia de un
// módulo de 24 a 12 meses, tiene sentido que eso aplique también a quien ya
// había aprobado — es el mismo criterio por el que `ReglaAsignacion` se
// recalcula contra el estado vigente y no contra una foto de cuando se creó
// la asignación.
//
// Todo el cálculo en UTC (getUTCFullYear/getUTCMonth/setUTCDate/etc.). Nunca
// hora local: el servidor puede correr en cualquier timezone y una fecha de
// vencimiento no puede depender de en qué huso está desplegado el proceso.

// Cuántos días antes del vencimiento una aprobación pasa a POR_VENCER — el
// aviso previo para que HSE pueda re-agendar antes de que la persona quede
// efectivamente vencida.
export const DIAS_AVISO_VENCIMIENTO = 30;

export type EstadoVigencia =
  | 'SIN_APROBAR'
  | 'VIGENTE'
  | 'POR_VENCER'
  | 'VENCIDO';

export interface Vencimiento {
  estado: EstadoVigencia;
  // null cuando no hay fecha que mostrar: SIN_APROBAR (nunca se aprobó) o
  // VIGENTE por `vigenciaMeses` nulo/0 (el módulo no vence nunca).
  venceEl: Date | null;
}

// Suma meses en UTC CLAMPEANDO al último día del mes destino. Date.setMonth()
// (o construir la fecha destino a mano con el mismo día) NO hace esto: 31/01
// + 1 mes desborda a "31 de febrero", que no existe, y JS lo normaliza
// corriéndolo a marzo — 31/01 termina siendo 02/03 o 03/03 en vez de quedarse
// en el 28/29 de febrero. Este clamp es LOAD-BEARING para la certificación:
// sin él, una vigencia cargada sobre un aprobado un día 31 se corre de mes en
// mes hasta desalinearse del todo.
export function sumarMeses(fecha: Date, meses: number): Date {
  const dia = fecha.getUTCDate();
  const horas = fecha.getUTCHours();
  const minutos = fecha.getUTCMinutes();
  const segundos = fecha.getUTCSeconds();
  const ms = fecha.getUTCMilliseconds();

  // Date.UTC(anio, mes + meses, 1) ya resuelve el acarreo de año: un
  // mes + meses de 12 o más (o negativo) normaliza solo, sin aritmética
  // modular escrita a mano. Se arranca en el día 1 para no arrastrar todavía
  // el día de origen a un mes que puede no tenerlo.
  const primerDiaDestino = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, 1),
  );
  const anioDestino = primerDiaDestino.getUTCFullYear();
  const mesDestino = primerDiaDestino.getUTCMonth();

  // Día 0 del mes siguiente al destino = último día del mes destino. Es el
  // truco estándar para "cuántos días tiene este mes" sin tabla de meses ni
  // lógica de año bisiesto escrita a mano — Date.UTC ya sabe febrero.
  const ultimoDiaDelMesDestino = new Date(
    Date.UTC(anioDestino, mesDestino + 1, 0),
  ).getUTCDate();

  const diaClamped = Math.min(dia, ultimoDiaDelMesDestino);

  return new Date(
    Date.UTC(anioDestino, mesDestino, diaClamped, horas, minutos, segundos, ms),
  );
}

// `ahora` con default a `new Date()` es lo que hace esto testeable sin fake
// timers: los tests pasan una fecha fija y comparan contra un `venceEl`
// conocido, en vez de mockear el reloj global.
export function calcularVencimiento(
  aprobadaEn: Date | null,
  vigenciaMeses: number | null,
  ahora: Date = new Date(),
): Vencimiento {
  if (aprobadaEn === null) {
    return { estado: 'SIN_APROBAR', venceEl: null };
  }

  // null o 0 = el módulo no vence nunca. Es el default de todos los módulos
  // cargados hoy (Modulo.vigenciaMeses es nullable y nadie lo carga
  // todavía), así que esta story no le cambia el comportamiento a nadie
  // hasta que se empiecen a cargar vigencias reales.
  if (!vigenciaMeses) {
    return { estado: 'VIGENTE', venceEl: null };
  }

  const venceEl = sumarMeses(aprobadaEn, vigenciaMeses);

  // >= y no >: el instante exacto del vencimiento ya cuenta como vencido, no
  // como el último instante vigente.
  if (ahora.getTime() >= venceEl.getTime()) {
    return { estado: 'VENCIDO', venceEl };
  }

  // "Días" acá son 24hs exactas, no días de calendario: `aprobadaEn` trae
  // hora (es Sesion.createdAt), así que un umbral de calendario dependería de
  // a qué hora del día se aprobó. Dividir la diferencia en milisegundos por
  // un día evita esa ambigüedad.
  const UN_DIA_EN_MS = 24 * 60 * 60 * 1000;
  const diasParaVencer = (venceEl.getTime() - ahora.getTime()) / UN_DIA_EN_MS;

  // <= y no <: a exactamente DIAS_AVISO_VENCIMIENTO días del vencimiento ya
  // se avisa, no un día después.
  if (diasParaVencer <= DIAS_AVISO_VENCIMIENTO) {
    return { estado: 'POR_VENCER', venceEl };
  }

  return { estado: 'VIGENTE', venceEl };
}
