// Corrección de una evaluación: funciones PURAS, sin Prisma ni Nest — mismo estilo
// que import/similitud.ts y storage/formato-imagen.ts. Vive aparte del service para
// que la regla de aprobación se pueda testear sin mockear una base de datos.
//
// Esto es la ÚNICA fuente de verdad del resultado. La tablet corrige local para
// mostrarle el score a la persona al instante, pero esa corrección es una copia: el
// backend nunca acepta `aprobada`/`porcentaje` del cliente. Es una certificación de
// seguridad laboral, no un puntaje de juego — sin esto, cualquiera con curl se
// aprueba todos los módulos.

// Umbral de aprobación, en porcentaje. Es el mismo 70 que hoy hardcodea
// calculateScore() de la app tablet (sima-check-app/src/utils/evaluation.js).
//
// No se lee al MOSTRAR un resultado viejo: se congela en Sesion.umbralAprobacion al
// registrar, así que subirlo a 80 mañana no reescribe lo que decían los certificados
// ya emitidos. El día que el umbral sea por módulo, esta constante pasa a ser el
// fallback y la columna ya soporta el cambio sin migrar nada.
export const UMBRAL_APROBACION_DEFAULT = 70;

export interface ResultadoEvaluacion {
  correctas: number;
  total: number;
  porcentaje: number;
  aprobada: boolean;
}

// Comparación por igualdad EXACTA de string, igual que la tablet
// (`answers[i] === q.correctAnswer`). En OPCIONES_IMAGEN lo que se compara es la
// clave cruda de storage ("preguntas/<uuid>.png"), nunca la URL armada: la clave es
// la identidad de la opción, la URL es sólo cómo se muestra.
//
// Sin respuesta (null/undefined) es incorrecta, no un error: "en blanco" es un
// estado válido de una evaluación.
export function esCorrecta(
  respuestaCorrecta: string,
  respuestaDada: string | null | undefined,
): boolean {
  if (respuestaDada === null || respuestaDada === undefined) return false;
  return respuestaDada === respuestaCorrecta;
}

// Agrega las correcciones en el resultado que se persiste. El `porcentaje` se
// redondea ACÁ y es el número con el que se decide: guardarlo evita que mostrarlo
// más tarde con otro redondeo contradiga al `aprobada` de la misma fila.
//
// `total: 0` devuelve 0% y no aprobada en vez de NaN. En la práctica no pasa (el DTO
// exige al menos una respuesta), pero una función pura no debería poder devolver NaN.
export function calcularResultado(
  correcciones: boolean[],
  umbral: number = UMBRAL_APROBACION_DEFAULT,
): ResultadoEvaluacion {
  const total = correcciones.length;
  const correctas = correcciones.filter(Boolean).length;
  const porcentaje = total === 0 ? 0 : Math.round((correctas / total) * 100);

  return {
    correctas,
    total,
    porcentaje,
    aprobada: total > 0 && porcentaje >= umbral,
  };
}
