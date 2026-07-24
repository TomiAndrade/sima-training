import Button from '../../components/Button'

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

  // Los catálogos solo traen activos, pero si el par ya tenía cargado un
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
          <select
            className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
            value={par.puestoId}
            onChange={(e) => updateRow(index, { puestoId: e.target.value })}
          >
            <option value="">— Puesto —</option>
            {optionsFor(puestos, par.puestoId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}{!p.activo ? ' (inactivo)' : ''}
              </option>
            ))}
          </select>
          <select
            className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
            value={par.centroCostoId}
            onChange={(e) => updateRow(index, { centroCostoId: e.target.value })}
          >
            <option value="">— Centro de costo —</option>
            {optionsFor(centrosCosto, par.centroCostoId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}{!c.activo ? ' (inactivo)' : ''}
              </option>
            ))}
          </select>
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
