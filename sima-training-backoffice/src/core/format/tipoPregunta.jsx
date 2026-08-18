// Badge del tipo de una pregunta del backend (VERDADERO_FALSO /
// OPCION_MULTIPLE / OPCIONES_IMAGEN / TEXTO_LIBRE — distintos de los del mock
// viejo: truefalse/multiple/image-options).
//
// Vive en `core/format/` porque lo usan **las dos capas**: `sima-check/` (el
// banco de preguntas, los criterios, el listado) y `core/` (el modal de import
// de Excel). Estaba en `sima-check/components/bancoModulo.jsx`, y el import
// desde `core/components/ImportPreguntasModal.jsx` violaba la regla de
// dependencia del proyecto — `core/` nunca importa de `sima-check/`. Mismo
// arreglo que ya se le había hecho a `formatVersionNumero`.
//
// Archivo propio y no dentro de `badges.js`: ese archivo declara en su cabecera
// que son **objetos planos de clases, no JSX, a propósito** (cada pantalla
// decide el tamaño y la forma del `<span>`; ahí sólo vive el color). Meter acá
// una función que devuelve JSX lo contradiría. Y tiene que ser `.jsx` —
// devuelve elementos, no strings.
export function backendTypeBadge(tipo) {
  if (tipo === 'VERDADERO_FALSO') return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-sky-50 text-sky-600 border-sky-200">V / F</span>
  if (tipo === 'OPCIONES_IMAGEN') return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-amber-50 text-amber-600 border-amber-200">Imágenes</span>
  if (tipo === 'TEXTO_LIBRE') return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-slate-100 text-slate-500 border-slate-200">Texto libre</span>
  return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-violet-50 text-violet-600 border-violet-200">Múltiple</span>
}
