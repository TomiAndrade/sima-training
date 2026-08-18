// Adapta una fila de catálogo (`Puesto` / `CentroCosto` / `Organizacion`) a la
// forma `{ id, label }` que consumen SearchableSelect y MultiSelectFilter.
//
// Vive en `core/format/` por el mismo motivo que `version.js` y `badges.js`: lo
// usan las dos capas y `core/` no puede importar de `sima-check/`.
//
// El sufijo " (inactivo)" es la convención que ya venían repitiendo a mano
// Usuarios.jsx y ParesPuestoCentro.jsx. Los catálogos se piden **completos** (no
// `?activo=true`) a propósito: un puesto dado de baja puede seguir teniendo
// gente asignada y hay que poder nombrarlo y encontrarlo. Marcarlo evita que se
// lea como uno vigente.
export function opcionesCatalogo(filas) {
  return (filas ?? []).map((f) => ({
    id: f.id,
    label: `${f.nombre}${f.activo === false ? ' (inactivo)' : ''}`,
  }))
}
