// Cómo se muestra el estado de reintentos que manda el backend en `pendientes`
// y en el resultado de una rendición.
//
// La forma es la de tablet/reintentos.ts:
//   { puedeRendir, motivo: 'OK'|'SIN_INTENTOS'|'EN_ESPERA',
//     intentosUsados, intentosRestantes, proximoIntentoEn }
//
// La REGLA la decide el backend, siempre: acá sólo se traduce a texto para no
// dejar tocar un botón que va a devolver 409. Un módulo sin parámetros
// declarados llega con puedeRendir: true e intentosRestantes: null, o sea que
// todo esto es invisible salvo que alguien lo haya configurado.

// El texto que explica por qué no se puede rendir. `null` cuando sí se puede.
export function motivoBloqueo(reintentos) {
  if (!reintentos || reintentos.puedeRendir) return null

  if (reintentos.motivo === 'SIN_INTENTOS') {
    return `Ya usaste tus ${reintentos.intentosUsados} intentos. Hablá con tu responsable de capacitación.`
  }
  if (reintentos.motivo === 'EN_ESPERA' && reintentos.proximoIntentoEn) {
    return `Podés reintentar a partir del ${formatearMomento(reintentos.proximoIntentoEn)}.`
  }
  return 'No podés rendir este módulo en este momento.'
}

// Aviso de intentos restantes cuando SÍ puede rendir. `null` si no hay tope
// declarado (el caso normal) — no tiene sentido avisar de un límite que no
// existe.
export function avisoIntentos(reintentos) {
  const quedan = reintentos?.intentosRestantes
  if (quedan == null || !reintentos.puedeRendir) return null
  return quedan === 1 ? 'Te queda 1 intento' : `Te quedan ${quedan} intentos`
}

// El backend manda la fecha como string ISO (viajó por JSON), no como Date.
function formatearMomento(iso) {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return 'más adelante'
  const dosDigitos = (n) => String(n).padStart(2, '0')
  return `${dosDigitos(fecha.getDate())}/${dosDigitos(fecha.getMonth() + 1)} a las ${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`
}
