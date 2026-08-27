// Normalización de texto para BUSCAR, no para mostrar ni para guardar.
//
// Sin acentos, en minúsculas y sin espacios al borde: los catálogos reales
// están llenos de acentos (Albañil, Cañista, Mecánico, Topografía, Logística) y
// nadie los tipea al buscar. Sin esto, buscar "canista" o "mecanico" no
// encuentra nada y el buscador parece roto.
//
// `\p{Diacritic}` sobre la forma NFD: descomponer separa la letra de su tilde y
// después se tiran las tildes. Es lo mismo que hace `similitud.ts` en el
// backend para comparar nombres del import de Excel — misma idea, otro runtime.
//
// ⚠️ `components/SearchableSelect.jsx` tiene su PROPIA copia de esto y no la
// importa de acá, a propósito: `components/` es un kit de UI que hoy no importa
// nada de la app (ni de `core/`), y esa independencia vale más que
// deduplicar tres líneas. Si eso cambia alguna vez, ahí se unifica.
export const normalizarTexto = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
