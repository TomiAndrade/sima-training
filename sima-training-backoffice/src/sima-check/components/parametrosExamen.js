// Helpers de los parámetros de examen de una versión de módulo (cuántas
// preguntas, umbral, reintentos, espera). Viven aparte de
// ParametrosExamenPanel.jsx porque ese archivo exporta un componente y la regla
// react-refresh/only-export-components no deja mezclar las dos cosas.
//
// La conversión de ida y vuelta vive acá y no en la pantalla porque hay tres
// consumidores (el modal de alta, el editor del borrador y el modal de
// detalles) y los tres necesitan la misma traducción.

// Los valores del formulario son STRING, igual que el resto de los formularios
// del proyecto: el casteo a número pasa recién en el submit. Un campo vacío
// significa "usar el default", que el backend persiste como null — no cero.
export const PARAMETROS_VACIOS = {
  preguntasPorExamen: '',
  umbralAprobacion: '',
  maxIntentos: '',
  esperaEntreIntentosMinutos: '',
}

// Los defaults del backend (PREGUNTAS_POR_EXAMEN en tablet.service.ts y
// UMBRAL_APROBACION_DEFAULT en sesiones/corregir.ts). Acá se usan sólo como
// placeholder y para explicar qué pasa si el campo queda vacío — el valor
// efectivo lo sigue resolviendo el servidor, nunca se manda desde el cliente.
export const DEFAULT_PREGUNTAS = 3
export const DEFAULT_UMBRAL = 70

// Versión del backend (números o null) → estado del formulario (strings).
export function parametrosDesdeVersion(version) {
  if (!version) return PARAMETROS_VACIOS
  const aTexto = (v) => (v == null ? '' : String(v))
  return {
    preguntasPorExamen: aTexto(version.preguntasPorExamen),
    umbralAprobacion: aTexto(version.umbralAprobacion),
    maxIntentos: aTexto(version.maxIntentos),
    esperaEntreIntentosMinutos: aTexto(version.esperaEntreIntentosMinutos),
  }
}

// Estado del formulario → body del PUT. El campo vacío viaja como `null` y NO
// como undefined: el endpoint es un reemplazo completo, y con undefined el
// backend no podría distinguir "no lo toques" de "volvelo al default".
export function parametrosAPayload(form) {
  const aNumero = (v) => (String(v).trim() === '' ? null : Number(v))
  return {
    preguntasPorExamen: aNumero(form.preguntasPorExamen),
    umbralAprobacion: aNumero(form.umbralAprobacion),
    maxIntentos: aNumero(form.maxIntentos),
    esperaEntreIntentosMinutos: aNumero(form.esperaEntreIntentosMinutos),
  }
}

// Los dos objetos tienen la misma forma y valores string, así que alcanza con
// comparar campo por campo para saber si hay cambios sin guardar.
export function parametrosDistintos(a, b) {
  return Object.keys(PARAMETROS_VACIOS).some((k) => a[k] !== b[k])
}

// "70% de 5 preguntas → 4 correctas". El backend decide por PORCENTAJE (compara
// contra el score redondeado de la sesión), así que esto es display puro: sirve
// para no tener que hacer la cuenta mental al elegir el umbral.
export function equivalenteEnCorrectas(preguntasTexto, umbralTexto) {
  const preguntas = Number(preguntasTexto) || DEFAULT_PREGUNTAS
  const umbral = Number(umbralTexto) || DEFAULT_UMBRAL
  if (preguntas < 1) return null
  return { preguntas, umbral, correctas: Math.ceil((preguntas * umbral) / 100) }
}
