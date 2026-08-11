// Número público AÑO.MAYOR.MENOR (ej. "2026.01.00"). Un borrador todavía no
// publicado no tiene número (anio/mayor/menor en null).
//
// Vive en core/ y no en sima-check/ porque lo consumen las dos capas: los
// módulos y sus versiones (sima-check) y el historial de rendiciones de una
// persona (core/pages/HistorialUsuario.jsx). La regla de dependencia del
// proyecto es que core/ nunca importa de sima-check/, así que lo compartido
// baja acá.
export function formatVersionNumero(v) {
  if (!v || v.anio == null || v.mayor == null || v.menor == null) return 'Borrador'
  const pad = (n) => String(n).padStart(2, '0')
  return `${v.anio}.${pad(v.mayor)}.${pad(v.menor)}`
}
