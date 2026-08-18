import Button from '../../components/Button'
import SearchableSelect from '../../components/SearchableSelect'
import { opcionesCatalogo } from '../format/catalogo'

// ABM local (en memoria) de los pares (puesto, centro de costo) de una
// vinculación. No pega al backend: el padre junta `pares` recién al guardar
// el usuario. `principal` es solo qué fila se muestra en el listado — el
// backend lo deriva del orden del array (el primero queda principal), acá
// se maneja como un campo por fila para que el radio sea simple.
export default function ParesPuestoCentro({ pares, onChange, puestos, centrosCosto }) {
  const updateRow = (index, patch) => {
    onChange(pares.map((par, i) => (i === index ? { ...par, ...patch } : par)))
  }

  const handleAdd = () => {
    onChange([...pares, { puestoId: '', centroCostoId: '', principal: pares.length === 0 }])
  }

  const handleRemove = (index) => {
    onChange(pares.filter((_, i) => i !== index))
  }

  const handleSetPrincipal = (index) => {
    onChange(pares.map((par, i) => ({ ...par, principal: i === index })))
  }

  // El padre pasa los catálogos COMPLETOS (no usa el `?activo=` de la API) justo
  // para esto: se ofrecen solo los activos, pero si el par ya tenía cargado un
  // puesto/centro que después se desactivó, lo mantenemos en las opciones
  // (marcado) para no perder el dato al editar.
  const optionsFor = (catalogo, currentId) => {
    const activos = catalogo.filter((item) => item.activo)
    if (currentId && !activos.some((item) => item.id === currentId)) {
      const actual = catalogo.find((item) => item.id === currentId)
      if (actual) return [...activos, actual]
    }
    return activos
  }

  return (
    <div className="space-y-3">
      {pares.length === 0 && (
        <p className="text-slate-400 text-sm">Sin puestos ni centros de costo asignados.</p>
      )}
      {pares.map((par, index) => (
        <div key={index} className="flex items-start gap-2">
          {/* Con buscador porque son los 88 puestos del catálogo real, y este
              es el formulario donde se carga a cada persona — el lugar donde
              más veces se elige uno. El panel va en portal (ver
              SearchableSelect): este componente vive dentro de un Modal, cuyo
              cuerpo recorta cualquier cosa flotante. */}
          <SearchableSelect
            className="flex-1"
            options={opcionesCatalogo(optionsFor(puestos, par.puestoId))}
            value={par.puestoId}
            onChange={(id) => updateRow(index, { puestoId: id })}
            placeholder="— Puesto —"
            searchPlaceholder="Buscar puesto…"
          />
          <SearchableSelect
            className="flex-1"
            options={opcionesCatalogo(optionsFor(centrosCosto, par.centroCostoId))}
            value={par.centroCostoId}
            onChange={(id) => updateRow(index, { centroCostoId: id })}
            placeholder="— Centro de costo —"
            searchPlaceholder="Buscar centro de costo…"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap pt-2.5">
            <input
              type="radio"
              name="par-principal"
              checked={!!par.principal}
              onChange={() => handleSetPrincipal(index)}
            />
            Principal
          </label>
          <button
            type="button"
            onClick={() => handleRemove(index)}
            className="text-red-600 hover:text-red-700 text-sm px-2 py-2"
          >
            Quitar
          </button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={handleAdd}>+ Agregar par</Button>
    </div>
  )
}
