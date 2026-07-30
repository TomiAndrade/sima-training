import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import MultiSelectFilter from '../../components/MultiSelectFilter'
import { reglasAsignacionApi } from '../../core/api/reglasAsignacion'
import { puestosApi } from '../../core/api/puestos'
import { centrosCostoApi } from '../../core/api/centrosCosto'
import { modulosApi } from '../../core/api/modulos'

const emptyForm = { centroCostoId: '', alcance: 'PUESTO', puestoIds: new Set(), moduloIds: new Set() }

// null y undefined representan el mismo alcance "de centro" (el backend
// guarda NULL, el body de creación simplemente omite el campo) — se
// normalizan a un mismo sentinel para que la key de comparación no los
// trate como casos distintos.
const puestoKey = (id) => id ?? '∅'
const reglaKey = (r) => `${puestoKey(r.puestoId)}|${r.centroCostoId}|${r.moduloId}`

const badgeBase = 'px-2.5 py-1 rounded-full text-xs font-semibold'

// Todas las mutaciones de regla devuelven `{ regla, recalculo }` y todas las de
// una misma tanda tocan el MISMO centro de costo, así que `usuarios` es siempre
// la misma gente: se toma el máximo, no la suma (sumar contaría N veces a cada
// persona). Las asignaciones sí se acumulan: son eventos distintos.
// SUPUESTO: un solo centro por tanda, invariante que hoy garantiza el modal de
// alta (un `<select>` de centro, N puestos × N módulos). Si alguna vez se
// permite elegir varios centros, este máximo subcuenta en silencio y no hay
// forma de arreglarlo desde acá: la API devuelve un conteo, no los ids, así que
// la unión real de personas no se puede calcular en el cliente.
const acumularRecalculo = (acc, r) => ({
  usuarios: Math.max(acc.usuarios, r?.usuarios ?? 0),
  creadas: acc.creadas + (r?.creadas ?? 0),
  revocadas: acc.revocadas + (r?.revocadas ?? 0),
})

const RECALCULO_CERO = { usuarios: 0, creadas: 0, revocadas: 0 }

// El plural irregular se pasa a mano ("asignación" → "asignaciones").
const plural = (n, singular, pl = `${singular}s`) => `${n} ${n === 1 ? singular : pl}`

export default function ReglasAsignacion() {
  const [reglas, setReglas] = useState([])
  const [puestos, setPuestos] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [modulos, setModulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [expandidos, setExpandidos] = useState(() => new Set())

  // null | { mode: 'create' } | { mode: 'edit', puestoId, centroCostoId, originales, reglaPorModulo }
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [result, setResult] = useState(null) // null | { created, existed, failed, errors, recalculo }

  // Tocar una regla recalcula en el acto a toda la gente con un par activo en su
  // centro de costo. El resumen se muestra acá arriba porque la consecuencia no
  // se ve en el listado: lo que cambia son las asignaciones de otras personas.
  const [aviso, setAviso] = useState(null) // null | { texto, recalculo }

  const [modalEliminar, setModalEliminar] = useState(null) // null | { regla, saving, error }

  const fetchAll = async () => {
    const [regs, pue, centros, mods] = await Promise.all([
      reglasAsignacionApi.list(),
      puestosApi.list(),
      centrosCostoApi.list(),
      modulosApi.list(),
    ])
    setReglas(regs)
    setPuestos(pue)
    setCentrosCosto(centros)
    setModulos(mods)
  }

  const loadData = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      await fetchAll()
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    fetchAll()
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  // Se piden los catálogos COMPLETOS a propósito, aunque /puestos y
  // /centros-costo ya soporten `?activo=`: más abajo hacen falta las dos cosas
  // a la vez — el subconjunto activo para los selects del modal de alta, y el
  // catálogo entero para los mapas id → nombre (las reglas viejas pueden
  // apuntar a un puesto o centro dado de baja, y ahí el nombre igual se
  // muestra). Por eso el filtro a activos sigue siendo del lado del cliente.
  const puestosActivos = useMemo(() => puestos.filter((p) => p.activo), [puestos])
  const centrosActivos = useMemo(() => centrosCosto.filter((c) => c.activo), [centrosCosto])
  const modulosActivos = useMemo(() => modulos.filter((m) => m.activo), [modulos])

  const puestoNombre = useMemo(() => new Map(puestos.map((p) => [p.id, p.nombre])), [puestos])
  const centroNombre = useMemo(() => new Map(centrosCosto.map((c) => [c.id, c.nombre])), [centrosCosto])
  const moduloPorId = useMemo(() => new Map(modulos.map((m) => [m.id, m])), [modulos])

  // El listado se lee por centro de costo: cada centro es un grupo desplegable y
  // las reglas quedan adentro. El centro deja de repetirse fila por fila y se
  // puede ver de un vistazo qué tiene configurado cada uno.
  const gruposPorCentro = useMemo(() => {
    const porCentro = new Map()
    reglas.forEach((r) => {
      const acc = porCentro.get(r.centroCostoId)
      if (acc) acc.push(r)
      else porCentro.set(r.centroCostoId, [r])
    })

    // Ordenar por el nombre crudo del módulo y no por moduloLabel(): esa función
    // se declara más abajo con const, y el callback de useMemo corre acá, así que
    // usarla tiraría un ReferenceError por TDZ. El sufijo "(sin versión
    // publicada)" no cambiaría el orden igual.
    const moduloNombre = (id) => moduloPorId.get(id)?.nombre ?? ''
    const ordenarReglas = (a, b) => {
      const aEsCentro = a.puestoId == null
      const bEsCentro = b.puestoId == null
      if (aEsCentro !== bEsCentro) return aEsCentro ? -1 : 1
      if (!aEsCentro) {
        const porPuesto = (puestoNombre.get(a.puestoId) ?? '').localeCompare(puestoNombre.get(b.puestoId) ?? '', 'es')
        if (porPuesto !== 0) return porPuesto
      }
      return moduloNombre(a.moduloId).localeCompare(moduloNombre(b.moduloId), 'es')
    }

    const armarGrupo = (centro, inactivo) => {
      const propias = [...(porCentro.get(centro.id) ?? [])].sort(ordenarReglas)

      // Segundo nivel de agrupación: las reglas del centro se juntan por ALCANCE
      // (el puesto, o "todos los puestos"). Es la unidad sobre la que opera
      // "Editar módulos", así que agrupar evita repetir ese botón en cada fila.
      // Se recorre `propias` ya ordenada, así el orden de los alcances sale
      // gratis del mismo criterio (centro primero, después por nombre de puesto).
      const porAlcance = new Map()
      const alcances = []
      propias.forEach((r) => {
        const clave = puestoKey(r.puestoId)
        let acc = porAlcance.get(clave)
        if (!acc) {
          acc = { clave, puestoId: r.puestoId ?? null, reglas: [] }
          porAlcance.set(clave, acc)
          alcances.push(acc)
        }
        acc.reglas.push(r)
      })

      return {
        centro,
        inactivo,
        reglas: propias,
        alcances,
        puestosCount: new Set(propias.filter((r) => r.puestoId != null).map((r) => r.puestoId)).size,
      }
    }

    // Los centros dados de baja no están en `centrosActivos`, pero sus reglas
    // siguen existiendo. Se derivan de las claves del índice y no de
    // `centrosCosto.filter(c => !c.activo)` para cubrir también el caso de un
    // centroCostoId que no figure en el catálogo: filtrando el catálogo esas
    // reglas desaparecerían de la pantalla sin dejar rastro.
    const idsActivos = new Set(centrosActivos.map((c) => c.id))
    const gruposActivos = centrosActivos.map((c) => armarGrupo(c, false))
    const gruposInactivos = [...porCentro.keys()]
      .filter((id) => !idsActivos.has(id))
      .map((id) => armarGrupo(centrosCosto.find((c) => c.id === id) ?? { id, nombre: '— Centro desconocido —' }, true))

    // Lo configurado arriba, lo pendiente de configurar agrupado abajo.
    const porNombre = (a, b) => a.centro.nombre.localeCompare(b.centro.nombre, 'es')
    return [
      ...gruposActivos.filter((g) => g.reglas.length > 0).sort(porNombre),
      ...gruposActivos.filter((g) => g.reglas.length === 0).sort(porNombre),
      ...gruposInactivos.sort(porNombre),
    ]
  }, [reglas, centrosActivos, centrosCosto, puestoNombre, moduloPorId])

  const centrosConReglas = useMemo(
    () => gruposPorCentro.filter((g) => g.reglas.length > 0).length,
    [gruposPorCentro]
  )

  // Expandir abre solo los grupos con contenido (abrir los vacíos es ruido);
  // colapsar vacía el Set entero, así no queda abierto un grupo vacío que el
  // usuario haya desplegado a mano.
  const expandibles = useMemo(
    () => gruposPorCentro.filter((g) => g.reglas.length > 0).map((g) => g.centro.id),
    [gruposPorCentro]
  )
  const todosExpandidos = expandibles.length > 0 && expandibles.every((id) => expandidos.has(id))

  const toggleExpandido = (id) =>
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleTodos = () => setExpandidos(todosExpandidos ? new Set() : new Set(expandibles))

  const contadorGrupo = (g) => {
    if (g.reglas.length === 0) return 'sin reglas'
    const reglasTxt = `${g.reglas.length} regla${g.reglas.length === 1 ? '' : 's'}`
    if (g.puestosCount === 0) return reglasTxt
    return `${g.puestosCount} puesto${g.puestosCount === 1 ? '' : 's'} · ${reglasTxt}`
  }

  const openCreate = () => {
    setForm({
      centroCostoId: centrosActivos[0]?.id ?? '',
      alcance: 'PUESTO',
      puestoIds: new Set(),
      moduloIds: new Set(),
    })
    setFormError(null)
    setResult(null)
    setModal({ mode: 'create' })
  }

  // Editar es el MISMO modal que el alta, con el alcance fijo y los módulos ya
  // configurados tildados: el alta siempre trabajó por alcance (centro + puestos
  // × módulos), así que editar fila por fila era la asimetría. Se guarda por
  // diff (tildar crea o revive, destildar elimina) en vez de con
  // `PATCH { moduloId }`: cambiar el módulo en el lugar conserva el id y el
  // createdAt de la fila, así que la regla queda diciendo que siempre obligó al
  // módulo nuevo y —sin AuditLog todavía— el anterior no queda registrado en
  // ningún lado. Alta + baja deja los dos hechos.
  const openEditAlcance = (regla) => {
    const delAlcance = reglas.filter(
      (r) => r.centroCostoId === regla.centroCostoId && puestoKey(r.puestoId) === puestoKey(regla.puestoId)
    )
    setForm({
      centroCostoId: regla.centroCostoId,
      alcance: regla.puestoId == null ? 'CENTRO' : 'PUESTO',
      puestoIds: regla.puestoId == null ? new Set() : new Set([regla.puestoId]),
      moduloIds: new Set(delAlcance.map((r) => r.moduloId)),
    })
    setFormError(null)
    setResult(null)
    setModal({
      mode: 'edit',
      puestoId: regla.puestoId ?? null,
      centroCostoId: regla.centroCostoId,
      // Foto de lo configurado al abrir: es contra esto que se diffea al guardar.
      originales: new Set(delAlcance.map((r) => r.moduloId)),
      // Para poder pasar de moduloId al id de la regla que hay que eliminar.
      reglaPorModulo: new Map(delAlcance.map((r) => [r.moduloId, r])),
    })
  }

  const closeModal = () => setModal(null)

  // Diff en vivo del modo edición, para el preview y para el guardado.
  const diffEdicion = useMemo(() => {
    if (modal?.mode !== 'edit') return null
    const agregados = [...form.moduloIds].filter((id) => !modal.originales.has(id))
    const eliminados = [...modal.originales].filter((id) => !form.moduloIds.has(id))
    return { agregados, eliminados }
  }, [modal, form.moduloIds])

  // Ergonomía de carga: se elige un centro de costo, un alcance y uno o
  // varios módulos; la pantalla expande eso a la unidad atómica del backend
  // (una regla por triple) y crea una por una. En alcance "puestos
  // específicos" además se eligen uno o varios puestos y se arma el
  // producto cartesiano puestoId × moduloId. En alcance "centro" cada
  // módulo elegido genera una regla de centro (puestoId ausente).
  const handleSave = async () => {
    if (modal?.mode === 'edit') return handleSaveEdicion()

    if (!form.centroCostoId) {
      setFormError('Elegí un centro de costo')
      return
    }
    if (form.alcance === 'PUESTO' && form.puestoIds.size === 0) {
      setFormError('Elegí al menos un puesto')
      return
    }
    if (form.moduloIds.size === 0) {
      setFormError('Elegí al menos un módulo')
      return
    }

    setSaving(true)
    setFormError(null)
    setAviso(null)
    try {
      // El POST reactiva un triple ya existente sin indicar en la respuesta
      // si lo creó o lo reactivó, así que la única forma de distinguir
      // "nueva" de "ya existía" desde el frontend es comparar contra el
      // listado actual antes de mandar los POST.
      const existentes = await reglasAsignacionApi.list()
      const existingKeys = new Set(existentes.map(reglaKey))

      const triples =
        form.alcance === 'CENTRO'
          ? [...form.moduloIds].map((moduloId) => ({ centroCostoId: form.centroCostoId, moduloId }))
          : [...form.puestoIds].flatMap((puestoId) =>
              [...form.moduloIds].map((moduloId) => ({ puestoId, centroCostoId: form.centroCostoId, moduloId }))
            )

      let created = 0
      let existed = 0
      const errors = []
      let recalculo = RECALCULO_CERO

      // Secuencial, no en paralelo: cada POST abre una transacción que recalcula
      // a toda la gente del centro, y todos los triples de esta tanda comparten
      // centro. Mandarlos juntos serían N transacciones peleándose por las
      // mismas filas de asignaciones.
      for (const triple of triples) {
        try {
          const res = await reglasAsignacionApi.create(triple)
          if (existingKeys.has(reglaKey(triple))) existed += 1
          else created += 1
          recalculo = acumularRecalculo(recalculo, res?.recalculo)
        } catch (err) {
          errors.push(err?.message ?? 'Error desconocido')
        }
      }

      setResult({ created, existed, failed: errors.length, errors: [...new Set(errors)], recalculo })
      if (created > 0 || existed > 0) {
        setAviso({
          texto: created > 0 ? plural(created, 'regla creada', 'reglas creadas') : 'Reglas actualizadas',
          recalculo,
        })
      }
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Aplica el diff del modo edición: alta para lo tildado que no estaba, baja
  // para lo destildado. Secuencial por el mismo motivo que el alta — cada
  // llamada recalcula todo el centro dentro de su propia transacción.
  const handleSaveEdicion = async () => {
    const { agregados, eliminados } = diffEdicion
    if (agregados.length === 0 && eliminados.length === 0) {
      setFormError('No hay cambios para guardar')
      return
    }

    setSaving(true)
    setFormError(null)
    setAviso(null)
    try {
      const errors = []
      let recalculo = RECALCULO_CERO
      let creadas = 0
      let borradas = 0

      for (const moduloId of agregados) {
        try {
          const res = await reglasAsignacionApi.create({
            ...(modal.puestoId ? { puestoId: modal.puestoId } : {}),
            centroCostoId: modal.centroCostoId,
            moduloId,
          })
          creadas += 1
          recalculo = acumularRecalculo(recalculo, res?.recalculo)
        } catch (err) {
          errors.push(err?.message ?? 'Error desconocido')
        }
      }

      for (const moduloId of eliminados) {
        const regla = modal.reglaPorModulo.get(moduloId)
        if (!regla) continue
        try {
          const res = await reglasAsignacionApi.remove(regla.id)
          borradas += 1
          recalculo = acumularRecalculo(recalculo, res?.recalculo)
        } catch (err) {
          errors.push(err?.message ?? 'Error desconocido')
        }
      }

      setResult({
        mode: 'edit',
        creadas,
        borradas,
        failed: errors.length,
        errors: [...new Set(errors)],
        recalculo,
      })
      if (creadas > 0 || borradas > 0) {
        const partes = []
        if (creadas > 0) partes.push(plural(creadas, 'regla agregada', 'reglas agregadas'))
        if (borradas > 0) partes.push(plural(borradas, 'eliminada', 'eliminadas'))
        setAviso({ texto: partes.join(' · '), recalculo })
      }
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (regla) => {
    setAviso(null)
    try {
      const res = await reglasAsignacionApi.setActivo(regla.id, !regla.activo)
      setAviso({
        texto: regla.activo ? 'Regla desactivada' : 'Regla activada',
        recalculo: res?.recalculo,
      })
      await loadData()
    } catch (err) {
      window.alert(`No se pudo actualizar: ${err.message}`)
    }
  }

  const handleEliminar = async () => {
    const { regla } = modalEliminar
    setModalEliminar((m) => ({ ...m, saving: true, error: null }))
    setAviso(null)
    try {
      const res = await reglasAsignacionApi.remove(regla.id)
      setModalEliminar(null)
      setAviso({ texto: 'Regla eliminada', recalculo: res?.recalculo })
      await loadData()
    } catch (err) {
      setModalEliminar((m) => ({ ...m, saving: false, error: err.message }))
    }
  }

  const moduloLabel = (m) => {
    if (!m) return '—'
    const sinVersionActiva = !m.vigente || m.vigente.estado !== 'ACTIVO'
    return sinVersionActiva ? `${m.nombre} (sin versión publicada)` : m.nombre
  }

  // En prosa, para los modales: "Soldador en Taller Central" / "todos los
  // puestos de Taller Central".
  const describirAlcance = (regla) => {
    const centro = centroNombre.get(regla.centroCostoId) ?? 'ese centro de costo'
    return regla.puestoId == null
      ? `todos los puestos de ${centro}`
      : `${puestoNombre.get(regla.puestoId) ?? 'ese puesto'} en ${centro}`
  }

  // Opciones del multi-select de Módulos. En modo edición se anota cuáles ya
  // están configuradas para ese alcance, y si la regla existente está
  // desactivada: destildar una desactivada la ELIMINA (el multi-select gobierna
  // existencia, no el eje activo/inactivo), y eso tiene que verse antes de
  // tocarla. También se agregan los módulos dados de baja del catálogo que ese
  // alcance ya tenga configurados, para no ofrecer destildarlos a ciegas.
  const opcionesModulos = useMemo(() => {
    const reglaPorModulo = modal?.mode === 'edit' ? modal.reglaPorModulo : null
    const extras = reglaPorModulo
      ? [...reglaPorModulo.keys()]
          .filter((id) => !modulosActivos.some((m) => m.id === id))
          .map((id) => moduloPorId.get(id))
          .filter(Boolean)
      : []
    return [...extras, ...modulosActivos].map((m) => {
      const regla = reglaPorModulo?.get(m.id)
      const sufijo = regla && !regla.activo ? ' · configurada (desactivada)' : ''
      return { id: m.id, label: `${moduloLabel(m)}${sufijo}` }
    })
  }, [modal, modulosActivos, moduloPorId])

  const selectCls = 'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Reglas de asignación</h2>
          <p className="text-slate-400 text-sm">
            {loading
              ? 'Cargando…'
              : `${reglas.length} regla${reglas.length === 1 ? '' : 's'} en ${centrosConReglas} centro${centrosConReglas === 1 ? '' : 's'} de costo`}
          </p>
        </div>
        <Button onClick={openCreate} disabled={loading || !!loadError}>+ Nueva regla</Button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between">
          <span>No se pudo conectar con la API: {loadError}</span>
          <Button variant="secondary" size="sm" onClick={loadData}>Reintentar</Button>
        </div>
      )}

      {aviso && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded px-4 py-3 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">
              {aviso.texto} · {plural(aviso.recalculo?.usuarios ?? 0, 'persona recalculada', 'personas recalculadas')}
            </p>
            {(aviso.recalculo?.creadas > 0 || aviso.recalculo?.revocadas > 0) && (
              <p className="text-indigo-600 text-xs mt-0.5">
                {plural(aviso.recalculo.creadas, 'asignación nueva', 'asignaciones nuevas')}
                {' · '}
                {plural(aviso.recalculo.revocadas, 'revocada', 'revocadas')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="text-indigo-400 hover:text-indigo-700 text-xs font-semibold transition-colors"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      )}

      {!loadError && (
        <>
          {expandibles.length > 0 && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={toggleTodos}
                className="text-slate-500 hover:text-slate-700 text-xs font-semibold transition-colors"
              >
                {todosExpandidos ? 'Colapsar todos' : 'Expandir todos'}
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-slate-400 text-[11px] font-mono uppercase tracking-widest text-center py-10">
              — Cargando… —
            </p>
          ) : gruposPorCentro.length === 0 ? (
            <p className="text-slate-400 text-[11px] font-mono uppercase tracking-widest text-center py-10">
              — Sin centros de costo — creá uno para configurar reglas —
            </p>
          ) : (
            <div className="space-y-2">
              {gruposPorCentro.map((g) => {
                const abierto = expandidos.has(g.centro.id)
                const cuerpoId = `grupo-${g.centro.id}`
                return (
                  <div key={g.centro.id} className="bg-white border border-slate-200 rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleExpandido(g.centro.id)}
                      aria-expanded={abierto}
                      aria-controls={cuerpoId}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-100"
                    >
                      <span className="text-xs text-slate-400">{abierto ? '▾' : '▸'}</span>
                      <span className="font-semibold text-slate-900">{g.centro.nombre}</span>
                      {g.inactivo && (
                        <span className={`${badgeBase} bg-slate-100 text-slate-500`}>
                          Centro inactivo
                        </span>
                      )}
                      <span className="ml-auto text-slate-400 text-xs">{contadorGrupo(g)}</span>
                    </button>
                    {abierto && (
                      <div id={cuerpoId} className="border-t border-slate-200">
                        {g.alcances.length > 0 ? (
                          <div className="divide-y divide-slate-200">
                            {g.alcances.map((a) => (
                              <div key={a.clave} className="px-4 py-3">
                                {/* Sub-header del alcance: acá vive "Editar
                                    módulos", una sola vez, porque el alcance es
                                    la unidad sobre la que opera. */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {a.puestoId == null ? (
                                    <span className={`${badgeBase} bg-indigo-50 text-indigo-600`}>Todos los puestos</span>
                                  ) : puestoNombre.get(a.puestoId) ? (
                                    <span className={`${badgeBase} bg-sky-50 text-sky-600`}>
                                      {puestoNombre.get(a.puestoId)}
                                    </span>
                                  ) : (
                                    // Sin píldora a propósito: es el caso en que
                                    // el nombre no se resolvió contra el catálogo,
                                    // y un "—" dentro de una píldora se leería
                                    // como un puesto llamado así.
                                    <span className="text-slate-400 text-sm">—</span>
                                  )}
                                  <span className="text-slate-400 text-xs">
                                    {plural(a.reglas.length, 'módulo')}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto"
                                    onClick={() => openEditAlcance(a.reglas[0])}
                                  >
                                    Editar módulos
                                  </Button>
                                </div>
                                <div className="mt-1.5 space-y-1">
                                  {a.reglas.map((r) => (
                                    <div key={r.id} className="flex items-center gap-3 pl-1">
                                      <span className="text-slate-700 text-sm flex-1 min-w-0 truncate">
                                        {moduloLabel(moduloPorId.get(r.moduloId))}
                                      </span>
                                      <span
                                        className={`${badgeBase} shrink-0 ${r.activo ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
                                      >
                                        {r.activo ? 'Activa' : 'Inactiva'}
                                      </span>
                                      <Button variant="secondary" size="sm" onClick={() => toggleActivo(r)}>
                                        {r.activo ? 'Desactivar' : 'Activar'}
                                      </Button>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => setModalEliminar({ regla: r, saving: false, error: null })}
                                      >
                                        Eliminar
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-4 py-6 text-center text-slate-400 text-sm">
                            Este centro no tiene reglas configuradas
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!modal}
        onClose={closeModal}
        title={modal?.mode === 'edit' ? 'Editar módulos del alcance' : 'Nueva regla'}
        footer={
          result ? (
            <Button onClick={closeModal}>Cerrar</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  (modal?.mode === 'edit'
                    ? // En edición, vaciar el set es válido (equivale a eliminar
                      // todas las reglas de ese alcance): lo que no se puede es
                      // guardar sin ningún cambio.
                      !diffEdicion || (diffEdicion.agregados.length === 0 && diffEdicion.eliminados.length === 0)
                    : !form.centroCostoId ||
                      form.moduloIds.size === 0 ||
                      (form.alcance === 'PUESTO' && form.puestoIds.size === 0))
                }
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded px-3 py-2">
              {result.mode === 'edit' ? (
                <>
                  {plural(result.creadas, 'regla agregada', 'reglas agregadas')}
                  {' · '}
                  {plural(result.borradas, 'eliminada', 'eliminadas')}
                </>
              ) : (
                <>
                  {result.created} regla{result.created === 1 ? '' : 's'} nueva{result.created === 1 ? '' : 's'}
                  {' · '}
                  {result.existed} ya {result.existed === 1 ? 'existía' : 'existían'}
                </>
              )}
              {result.failed > 0 && <> · {result.failed} fallaron</>}
            </div>
            {result.recalculo?.usuarios > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded px-3 py-2">
                {plural(result.recalculo.usuarios, 'persona recalculada', 'personas recalculadas')}
                {(result.recalculo.creadas > 0 || result.recalculo.revocadas > 0) && (
                  <>
                    {' · '}
                    {plural(result.recalculo.creadas, 'asignación nueva', 'asignaciones nuevas')}
                    {' · '}
                    {plural(result.recalculo.revocadas, 'revocada', 'revocadas')}
                  </>
                )}
              </div>
            )}
            {result.failed > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2 space-y-1">
                {result.errors.map((msg, i) => <div key={i}>{msg}</div>)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
                {formError}
              </div>
            )}
            {/* En edición el alcance es fijo: mover una regla de lugar es
                eliminarla y crear otra, no editarla. Se muestra como contexto en
                vez de como controles deshabilitados. */}
            {modal?.mode === 'edit' ? (
              <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Alcance</p>
                <p className="text-slate-700 text-sm">
                  {modal.puestoId == null ? (
                    <>
                      <span className={`${badgeBase} bg-indigo-50 text-indigo-600`}>Todos los puestos</span>{' '}
                      de {centroNombre.get(modal.centroCostoId) ?? '—'}
                    </>
                  ) : (
                    <>
                      <span className={`${badgeBase} bg-sky-50 text-sky-600`}>
                        {puestoNombre.get(modal.puestoId) ?? '—'}
                      </span>{' '}
                      en {centroNombre.get(modal.centroCostoId) ?? '—'}
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-1">Centro de costo</label>
                <select
                  className={selectCls}
                  value={form.centroCostoId}
                  onChange={(e) => setForm((f) => ({ ...f, centroCostoId: e.target.value }))}
                >
                  {centrosActivos.length === 0 && <option value="">— Sin centros activos —</option>}
                  {centrosActivos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            {modal?.mode !== 'edit' && (
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-1">Alcance</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="alcance"
                      checked={form.alcance === 'CENTRO'}
                      onChange={() => setForm((f) => ({ ...f, alcance: 'CENTRO', puestoIds: new Set() }))}
                    />
                    Todo el centro
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="alcance"
                      checked={form.alcance === 'PUESTO'}
                      onChange={() => setForm((f) => ({ ...f, alcance: 'PUESTO' }))}
                    />
                    Puestos específicos
                  </label>
                </div>
              </div>
            )}
            {modal?.mode !== 'edit' && form.alcance === 'PUESTO' && (
              <div>
                <label className="block text-slate-700 text-sm font-medium mb-1">Puestos</label>
                <MultiSelectFilter
                  options={puestosActivos.map((p) => ({ id: p.id, label: p.nombre }))}
                  selectedIds={form.puestoIds}
                  onChange={(ids) => setForm((f) => ({ ...f, puestoIds: ids }))}
                  placeholder="Elegí uno o varios puestos"
                  searchPlaceholder="Buscar puesto..."
                />
              </div>
            )}
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">Módulos</label>
              <MultiSelectFilter
                options={opcionesModulos}
                selectedIds={form.moduloIds}
                onChange={(ids) => setForm((f) => ({ ...f, moduloIds: ids }))}
                placeholder="Elegí uno o varios módulos"
                searchPlaceholder="Buscar módulo..."
              />
            </div>
            {modal?.mode === 'edit' && diffEdicion && (
              <div className="space-y-2">
                <p className="text-slate-500 text-xs">
                  {diffEdicion.agregados.length === 0 && diffEdicion.eliminados.length === 0
                    ? 'Sin cambios respecto de lo configurado.'
                    : `Se agregan ${diffEdicion.agregados.length} · se eliminan ${diffEdicion.eliminados.length}.`}
                </p>
                {diffEdicion.eliminados.length > 0 && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2 space-y-1">
                    <p className="font-semibold">
                      Al guardar se {diffEdicion.eliminados.length === 1 ? 'elimina' : 'eliminan'} de este alcance:
                    </p>
                    <ul className="list-disc list-inside">
                      {diffEdicion.eliminados.map((id) => (
                        <li key={id}>{moduloLabel(moduloPorId.get(id))}</li>
                      ))}
                    </ul>
                    <p>
                      Las reglas salen del listado y no se recuperan desde el backoffice; las asignaciones automáticas
                      que justificaban se revocan en el acto.
                    </p>
                  </div>
                )}
              </div>
            )}
            {modal?.mode !== 'edit' && form.alcance === 'CENTRO' && form.moduloIds.size > 0 && (
              <p className="text-slate-400 text-xs">
                Se van a crear hasta {form.moduloIds.size} regla{form.moduloIds.size === 1 ? '' : 's'} de centro
                ({centroNombre.get(form.centroCostoId) ?? 'centro elegido'} → todos los puestos).
              </p>
            )}
            {modal?.mode !== 'edit' && form.alcance === 'PUESTO' && form.puestoIds.size > 0 && form.moduloIds.size > 0 && (
              <p className="text-slate-400 text-xs">
                Se van a crear hasta {form.puestoIds.size * form.moduloIds.size} reglas
                ({form.puestoIds.size} puesto{form.puestoIds.size === 1 ? '' : 's'} × {form.moduloIds.size} módulo{form.moduloIds.size === 1 ? '' : 's'}).
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!modalEliminar}
        onClose={() => setModalEliminar(null)}
        title="Eliminar regla"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalEliminar(null)} disabled={modalEliminar?.saving}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleEliminar} disabled={modalEliminar?.saving}>
              {modalEliminar?.saving ? 'Eliminando…' : 'Eliminar regla'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {modalEliminar?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
              {modalEliminar.error}
            </div>
          )}
          {modalEliminar && (
            <>
              <p className="text-slate-700 text-sm">
                Se va a eliminar la regla que obliga a{' '}
                <span className="font-semibold">{describirAlcance(modalEliminar.regla)}</span> a rendir{' '}
                <span className="font-semibold">{moduloLabel(moduloPorId.get(modalEliminar.regla.moduloId))}</span>.
              </p>
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
                La regla sale del listado y no se puede recuperar desde el backoffice. Las asignaciones automáticas
                que justificaba se revocan en el acto.
              </div>
              <p className="text-slate-500 text-xs">
                Si solo querés dejarla en pausa, usá <span className="font-semibold">Desactivar</span>: la regla deja
                de generar obligaciones pero sigue acá y se puede volver a activar.
              </p>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
