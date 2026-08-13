// Cuántas veces más puede rendir una persona un módulo, y desde cuándo.
// Funciones PURAS, sin Prisma ni Nest — mismo estilo que sorteo.ts,
// sesiones/corregir.ts y asignaciones/vigencia.ts.
//
// Las dos reglas las declara la ModuloVersion ACTIVO (maxIntentos y
// esperaEntreIntentosMinutos); con las dos en null el comportamiento es el que
// hubo siempre: reintentos infinitos y sin espera.
//
// DOS decisiones que gobiernan todo lo de abajo:
//
//   1. Los intentos se cuentan por MÓDULO, no por versión. Que salga una versión
//      nueva no le devuelve intentos a nadie: el tope existe para que no se
//      apruebe a fuerza de repetir hasta que salga el sorteo fácil, y eso no
//      cambia porque se reordenen las preguntas.
//   2. El contador se RESETEA al aprobar. Sólo cuentan las sesiones posteriores a
//      la última aprobación, así que cuando la vigencia vence y la persona tiene
//      que recertificar, arranca con todos sus intentos de nuevo. Sin esto,
//      alguien que aprobó raspando hace tres años ya llegaría con el tope
//      agotado a la recertificación.

export type MotivoReintentos = 'OK' | 'SIN_INTENTOS' | 'EN_ESPERA';

export interface EstadoReintentos {
  puedeRendir: boolean;
  motivo: MotivoReintentos;
  intentosUsados: number;
  // null = sin tope declarado. Distinto de 0, que es "se te acabaron".
  intentosRestantes: number | null;
  // Cuándo se libera la espera. null si no hay espera pendiente — incluido el
  // caso SIN_INTENTOS, donde esperar no sirve de nada.
  proximoIntentoEn: Date | null;
}

// Lo mínimo que hace falta de cada Sesion. `finalizadaEn` y no `createdAt`: lo
// que ordena los intentos es cuándo se rindió, no cuándo llegó al servidor (con
// el modo offline pendiente, una sesión vieja puede sincronizarse mucho después).
export interface SesionRendida {
  finalizadaEn: Date;
  aprobada: boolean;
}

export function evaluarReintentos(params: {
  // TODAS las sesiones de esa persona en ese módulo (cualquier versión), sin
  // ordenar: acá se ordenan.
  sesiones: readonly SesionRendida[];
  maxIntentos: number | null;
  esperaMinutos: number | null;
  ahora: Date;
}): EstadoReintentos {
  const { maxIntentos, esperaMinutos, ahora } = params;

  const ordenadas = [...params.sesiones].sort(
    (a, b) => a.finalizadaEn.getTime() - b.finalizadaEn.getTime(),
  );

  // El corte del reset: todo lo anterior a la última aprobación ya no cuenta.
  const ultimaAprobacion = ordenadas.filter((s) => s.aprobada).pop();
  const cuentan = ultimaAprobacion
    ? ordenadas.filter(
        (s) =>
          s.finalizadaEn.getTime() > ultimaAprobacion.finalizadaEn.getTime(),
      )
    : ordenadas;

  const intentosUsados = cuentan.length;
  const intentosRestantes =
    maxIntentos == null ? null : Math.max(0, maxIntentos - intentosUsados);

  // El tope va PRIMERO y es terminal: si no quedan intentos, no tiene sentido
  // ofrecer una fecha a partir de la cual igual no va a poder rendir.
  if (maxIntentos != null && intentosUsados >= maxIntentos) {
    return {
      puedeRendir: false,
      motivo: 'SIN_INTENTOS',
      intentosUsados,
      intentosRestantes: 0,
      proximoIntentoEn: null,
    };
  }

  const ultima = cuentan[cuentan.length - 1];
  if (esperaMinutos != null && ultima) {
    const habilitado = new Date(
      ultima.finalizadaEn.getTime() + esperaMinutos * 60_000,
    );
    if (habilitado.getTime() > ahora.getTime()) {
      return {
        puedeRendir: false,
        motivo: 'EN_ESPERA',
        intentosUsados,
        intentosRestantes,
        proximoIntentoEn: habilitado,
      };
    }
  }

  return {
    puedeRendir: true,
    motivo: 'OK',
    intentosUsados,
    intentosRestantes,
    proximoIntentoEn: null,
  };
}

// El mensaje que ve la persona en la tablet cuando se le niega el examen. Vive
// acá y no en el service para que el texto se pueda testear junto con la regla
// que lo produce.
export function mensajeReintentos(estado: EstadoReintentos): string {
  if (estado.motivo === 'SIN_INTENTOS') {
    return `Ya usaste los ${estado.intentosUsados} intentos disponibles para este módulo. Hablá con tu responsable de capacitación.`;
  }
  if (estado.motivo === 'EN_ESPERA' && estado.proximoIntentoEn) {
    return `Todavía no podés volver a rendir este módulo. Vas a poder reintentarlo a partir del ${formatearMomento(estado.proximoIntentoEn)}.`;
  }
  return 'No podés rendir este módulo en este momento.';
}

// dd/mm/aaaa a las HH:MM, en la zona horaria del servidor. Sin Intl ni locales:
// es el mismo formato que ya usan los frontends para las fechas del dominio.
function formatearMomento(fecha: Date): string {
  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  const dia = dosDigitos(fecha.getDate());
  const mes = dosDigitos(fecha.getMonth() + 1);
  const hora = dosDigitos(fecha.getHours());
  const minutos = dosDigitos(fecha.getMinutes());
  return `${dia}/${mes}/${fecha.getFullYear()} a las ${hora}:${minutos}`;
}
