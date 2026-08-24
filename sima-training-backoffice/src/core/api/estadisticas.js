import { api } from './client'

export const estadisticasApi = {
  // Estadísticas de CONTENIDO de SIMA CHECK en un solo request: ranking de
  // preguntas con su distribución de respuestas, acierto por base y nivel, y
  // los cortes por centro de costo y puesto.
  //
  // Es lectura pura y no pide token, igual que el resto de los GET: el payload
  // no incluye la respuesta correcta de ninguna pregunta (la distribución dice
  // cuál de las opciones era la buena, sin devolver el string). Lo que sí la
  // expone es el detalle de un intento — ver sesiones.js.
  simaCheck: () => api.get('/estadisticas/sima-check'),
}

// Cuántas respuestas necesita una pregunta para que su porcentaje signifique
// algo. Espeja MINIMO_SIGNIFICATIVO de estadisticas.service.ts — el backend no
// lo manda en el payload, así que esta copia tiene que moverse con aquella.
export const MINIMO_SIGNIFICATIVO = 5
