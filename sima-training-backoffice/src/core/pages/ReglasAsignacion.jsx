import { useEffect, useMemo, useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import MultiSelectFilter from '../../components/MultiSelectFilter'
import { reglasAsignacionApi } from '../api/reglasAsignacion'
import { puestosApi } from '../api/puestos'
import { centrosCostoApi } from '../api/centrosCosto'
import { modulosApi } from '../api/modulos'

const emptyForm = { centroCostoId: '', alcance: 'PUESTO', puestoIds: new Set(), moduloIds: new Set() }

// null y undefined representan el mismo alcance "de centro" (el backend
// guarda NULL, el body de creación simplemente omite el campo) — se
// normalizan a un mismo sentinel para que la key de comparación no los
// trate como casos distintos.
const puestoKey = (id) => id ?? '∅'
const reglaKey = (r) => `${puestoKey(r.puestoId)}|${r.centroCostoId}|${r.moduloId}`

export default function ReglasAsignacion() {
  const [reglas, setReglas] = useState([])
  const [puestos, setPuestos] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])
  const [modulos, setModulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [alcanceFiltro, setAlcanceFiltro] = useState('TODOS') // 'TODOS' | 'PUESTO' | 'CENTRO'

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [result, setResult] = useState(null) // null | { created, existed, failed, errors }

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  // Ninguno de los tres catálogos soporta `?activo=` en el listado (ver
  // core/pages/Usuarios.jsx), así que se filtra a activos en el cliente.
  const puestosActivos = useMemo(() => puestos.filter((p) => p.activo), [puestos])
  const centrosActivos = useMemo(() => centrosCosto.filter((c) => c.activo), [centrosCosto])
  const modulosActivos = useMemo(() => modulos.filter((m) => m.activo), [modulos])

  const puestoNombre = useMemo(() => new Map(puestos.map((p) => [p.id, p.nombre])), [puestos])
  const centroNombre = useMemo(() => new Map(centrosCosto.map((c) => [c.id, c.nombre])), [centrosCosto])
  const moduloPorId = useMemo(() => new Map(modulos.map((m) => [m.id, m])), [modulos])

  const reglasFiltradas = useMemo(() => {
    if (alcanceFiltro === 'TODOS') return reglas
    return reglas.filter((r) => (alcanceFiltro === 'CENTRO' ? r.puestoId == null : r.puestoId != null))
  }, [reglas, alcanceFiltro])

  const openCreate = () => {
    setForm({
      centroCostoId: centrosActivos[0]?.id ?? '',
      alcance: 'PUESTO',
      puestoIds: new Set(),
      moduloIds: new Set(),
    })
    setFormError(null)
    setResult(null)
    setModal(true)
  }

  const closeModal = () => setModal(false)

  // Ergonomía de carga: se elige un centro de costo, un alcance y uno o
  // varios módulos; la pantalla expande eso a la unidad atómica del backend
  // (una regla por triple) y crea una por una. En alcance "puestos
  // específicos" además se eligen uno o varios puestos y se arma el
  // producto cartesiano puestoId × moduloId. En alcance "centro" cada
  // módulo elegido genera una regla de centro (puestoId ausente).
  const handleSave = async () => {
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

      const settled = await Promise.allSettled(triples.map((t) => reglasAsignacionApi.create(t)))

      let created = 0
      let existed = 0
      const errors = []
      settled.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          if (existingKeys.has(reglaKey(triples[i]))) existed += 1
          else created += 1
        } else {
          errors.push(res.reason?.message ?? 'Error desconocido')
        }
      })

      setResult({ created, existed, failed: errors.length, errors: [...new Set(errors)] })
      await loadData()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (regla) => {
    try {
      await reglasAsignacionApi.setActivo(regla.id, !regla.activo)
      await loadData()
    } catch (err) {
      window.alert(`No se pudo actualizar: ${err.message}`)
    }
  }

  const moduloLabel = (m) => {
    if (!m) return '—'
    const sinVersionActiva = !m.vigente || m.vigente.estado !== 'ACTIVO'
    return sinVersionActiva ? `${m.nombre} (sin versión publicada)` : m.nombre
  }

  const columns = [
    {
      key: 'puestoId',
      label: 'Puesto',
      render: (id) =>
        id == null ? (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600">
            Todos los puestos
          </span>
        ) : (
          puestoNombre.get(id) ?? '—'
        ),
    },
    { key: 'centroCostoId', label: 'Centro de costo', render: (id) => centroNombre.get(id) ?? '—' },
    { key: 'moduloId', label: 'Módulo', render: (id) => moduloLabel(moduloPorId.get(id)) },
    {
      key: 'activo',
      label: 'Estado',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {val ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
  ]

  const selectCls = 'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Reglas de asignación</h2>
          <p className="text-slate-400 text-sm">
            {loading ? 'Cargando…' : `${reglas.length} regla${reglas.length !== 1 ? 's' : ''} registradas`}
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

      {!loadError && (
        <>
          <div className="flex items-center gap-2">
            {[
              { value: 'TODOS', label: 'Todas' },
              { value: 'PUESTO', label: 'Por puesto' },
              { value: 'CENTRO', label: 'De centro' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAlcanceFiltro(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  alcanceFiltro === opt.value ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Table
            columns={columns}
            data={reglasFiltradas}
            actions={(row) => (
              <Button variant={row.activo ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActivo(row)}>
                {row.activo ? 'Desactivar' : 'Activar'}
              </Button>
            )}
          />
        </>
      )}

      <Modal
        open={modal}
        onClose={closeModal}
        title="Nueva regla"
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
                  !form.centroCostoId ||
                  form.moduloIds.size === 0 ||
                  (form.alcance === 'PUESTO' && form.puestoIds.size === 0)
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
              {result.created} regla{result.created === 1 ? '' : 's'} nueva{result.created === 1 ? '' : 's'}
              {' · '}
              {result.existed} ya {result.existed === 1 ? 'existía' : 'existían'}
              {result.failed > 0 && <> · {result.failed} fallaron</>}
            </div>
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
            {form.alcance === 'PUESTO' && (
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
                options={modulosActivos.map((m) => ({ id: m.id, label: moduloLabel(m) }))}
                selectedIds={form.moduloIds}
                onChange={(ids) => setForm((f) => ({ ...f, moduloIds: ids }))}
                placeholder="Elegí uno o varios módulos"
                searchPlaceholder="Buscar módulo..."
              />
            </div>
            {form.alcance === 'CENTRO' && form.moduloIds.size > 0 && (
              <p className="text-slate-400 text-xs">
                Se van a crear hasta {form.moduloIds.size} regla{form.moduloIds.size === 1 ? '' : 's'} de centro
                ({centroNombre.get(form.centroCostoId) ?? 'centro elegido'} → todos los puestos).
              </p>
            )}
            {form.alcance === 'PUESTO' && form.puestoIds.size > 0 && form.moduloIds.size > 0 && (
              <p className="text-slate-400 text-xs">
                Se van a crear hasta {form.puestoIds.size * form.moduloIds.size} reglas
                ({form.puestoIds.size} puesto{form.puestoIds.size === 1 ? '' : 's'} × {form.moduloIds.size} módulo{form.moduloIds.size === 1 ? '' : 's'}).
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
