// Cómo se PINTAN las opciones de una pregunta. Vive en core/format/ y no en
// sima-check/ porque lo usan las dos capas: el modal "Ver pregunta" del banco
// (sima-check/components/BancoPreguntas.jsx) y el modal "Ver intento" de la
// hoja de vida (core/components/VerIntentoModal.jsx), que está en core/ y por
// lo tanto NO puede importar de sima-check/.
//
// Es el mismo camino que ya recorrió `backendTypeBadge`: cuando un helper lo
// necesitan las dos capas, sube a core/format/ — no se importa hacia abajo.

// Letras de las opciones tal cual las pinta la tablet (`QuestionCard`), para que
// "la B" signifique lo mismo mirando el backoffice que mirando el atril.
export const LETRAS_OPCION = ['A', 'B', 'C', 'D']

// Las dos opciones de VERDADERO_FALSO no están en `opciones` (el jsonb viene
// vacío): las pone el frontend. Son estos dos strings exactos, que es contra lo
// que el backend corrige — ver `corregir.ts`.
export const OPCIONES_VF = ['Verdadero', 'Falso']

// Las opciones a mostrar de una pregunta, resolviendo el caso de V/F.
export function opcionesDe(pregunta) {
  if (pregunta.tipo === 'VERDADERO_FALSO') return OPCIONES_VF
  return pregunta.opciones ?? []
}

// Recuadro de una opción. Se usa igual para texto y para imagen.
//
// Tres estados y no dos, porque el modal de un intento tiene que mostrar a la
// vez cuál era la correcta y cuál eligió la persona:
//   - correcta (la eligiera o no)         → esmeralda
//   - elegida pero incorrecta             → rojo
//   - ninguna de las dos                  → neutra
//
// No depende sólo del color: quien la use tiene que poner además el ✓/✗ y la
// palabra, que es lo que la hace legible de un vistazo (y accesible).
export function marcaOpcion(esCorrecta, esElegida = false) {
  if (esCorrecta) return 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
  if (esElegida) return 'border-red-400 bg-red-50 ring-1 ring-red-400'
  return 'border-slate-200 bg-white'
}
