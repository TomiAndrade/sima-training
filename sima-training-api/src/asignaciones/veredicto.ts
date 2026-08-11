// Veredicto de habilitación de una persona: función PURA, sin Prisma ni Nest —
// mismo patrón que asignaciones/vigencia.ts y sesiones/corregir.ts.
//
// Es una jerarquía de GRAVEDAD, no de conteo: una sola asignación vencida pesa
// más que diez pendientes de aprobar. No se cuentan casos ni se promedian
// estados — se busca la peor situación entre las asignaciones vigentes de la
// persona y esa sola basta para decidir el veredicto global.

import { EstadoVigencia } from './vigencia';

export type EstadoVeredicto =
  | 'NO_HABILITADO' // alguna asignación no-revocada está VENCIDO
  | 'PENDIENTE' // sin vencidas; alguna no-revocada está SIN_APROBAR
  | 'POR_VENCER' // sin las dos anteriores; alguna no-revocada está POR_VENCER
  | 'EN_REGLA' // todas las no-revocadas están VIGENTE
  | 'SIN_OBLIGACIONES'; // no tiene ninguna asignación no-revocada

export interface AsignacionParaVeredicto {
  id: string;
  moduloNombre: string;
  revocadaAt: Date | null;
  vencimiento: { estado: EstadoVigencia };
}

export interface Veredicto {
  estado: EstadoVeredicto;
  // La asignación puntual que DISPARA el estado. null solo si EN_REGLA (todas
  // están bien, no hay una "culpable") o SIN_OBLIGACIONES (no hay ninguna).
  asignacion: { id: string; moduloNombre: string } | null;
}

// Orden de gravedad, de peor a mejor. La jerarquía se recorre en este orden y
// la primera que matchea gana — no se siguen evaluando las de abajo.
const JERARQUIA: {
  estadoVigencia: EstadoVigencia;
  estadoVeredicto: EstadoVeredicto;
}[] = [
  { estadoVigencia: 'VENCIDO', estadoVeredicto: 'NO_HABILITADO' },
  { estadoVigencia: 'SIN_APROBAR', estadoVeredicto: 'PENDIENTE' },
  { estadoVigencia: 'POR_VENCER', estadoVeredicto: 'POR_VENCER' },
];

export function calcularVeredicto(
  asignaciones: AsignacionParaVeredicto[],
): Veredicto {
  // Una asignación revocada ya no le corresponde a la persona, aunque haya
  // estado vencida antes de revocarse.
  const vigentes = asignaciones.filter((a) => a.revocadaAt === null);

  if (vigentes.length === 0) {
    return { estado: 'SIN_OBLIGACIONES', asignacion: null };
  }

  for (const { estadoVigencia, estadoVeredicto } of JERARQUIA) {
    // Ante varias asignaciones en el mismo estado disparador (ej. dos
    // VENCIDO), se elige la PRIMERA que aparece en el array de entrada — no
    // hay criterio de "peor" entre dos vencidas, así que no se inventa un
    // desempate nuevo.
    const disparadora = vigentes.find(
      (a) => a.vencimiento.estado === estadoVigencia,
    );
    if (disparadora) {
      return {
        estado: estadoVeredicto,
        asignacion: {
          id: disparadora.id,
          moduloNombre: disparadora.moduloNombre,
        },
      };
    }
  }

  // Ninguna VENCIDO/SIN_APROBAR/POR_VENCER: todas están VIGENTE.
  return { estado: 'EN_REGLA', asignacion: null };
}
