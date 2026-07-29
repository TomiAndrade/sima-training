import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import { importApi } from '../api/import'
import { organizacionesApi } from '../api/organizaciones'
import { puestosApi } from '../api/puestos'
import { centrosCostoApi } from '../api/centrosCosto'
import EstadoSimilitudBadge from './estadoSimilitudBadge'

// Espejo de matriz-rol-organizacion.ts (ver TIPOS_ORG_POR_ROL en Usuarios.jsx):
// el import siempre da de alta usuarios como ALUMNO, así que solo tiene sentido
// elegir una organización que admita ese rol (INTERNA o SUBCONTRATISTA).
const TIPOS_ORG_ALUMNO = ['INTERNA', 'SUBCONTRATISTA']

// step: 'select' | 'preview' | 'result'
const INITIAL = {
  step: 'select',
  file: null,
  organizacionId: '',
  preview: null,
  result: null,
  loading: false,
  error: null,
  selected: new Set(),  // preview.filas[].index incluidos en el import
  decisiones: {},        // clave grupo -> decisión (ver claveGrupo/buildDecisiones)
}

// Agrupa por texto (no por fila): 5 filas con el mismo puesto nuevo comparten
// una sola decisión, y evita crear el mismo catálogo 2 veces al confirmar.
const claveGrupo = (tipo, texto) => `${tipo}:${texto.trim().toLowerCase()}`

// Una decisión por grupo de texto no resuelto (duplicada no genera grupo: se
// resuelve directo con el id del catálogo, sin intervención). Default:
// parecida → usar el sugerido; nueva → crear un catálogo nuevo con ese texto.
function buildDecisiones(filas) {
  const decisiones = {}
  for (const f of filas) {
    for (const tipo of ['puesto', 'centroCosto']) {
      const clasif = f[tipo]
      if (!clasif || clasif.estado === 'duplicada') continue
      const key = claveGrupo(tipo, clasif.texto)
      if (decisiones[key]) continue
      decisiones[key] = {
        tipo,
        textoOriginal: clasif.texto,
        estado: clasif.estado,
        similar: clasif.similar,
        accion: clasif.estado === 'parecida' ? 'usar_sugerido' : 'crear_nuevo',
        catalogoId: '',
      }
    }
  }
  return decisiones
}

function grupoResuelto(g) {
  if (!g) return true // sin grupo (match exacto) siempre está resuelto
  if (g.accion === 'usar_sugerido') return !!g.similar?.preguntaId
  if (g.accion === 'crear_nuevo') return true // se crea recién al confirmar
  if (g.accion === 'elegir') return !!g.catalogoId
  return false
}

// Crea el catálogo nuevo; si otra fila (u otro admin) ya lo creó con el mismo
// nombre en el medio, el POST devuelve 409 (assertNombreDisponible) — en vez
// de abortar, se busca el id en el catálogo recién refrescado.
async function crearOResolverCatalogo(api, nombre) {
  try {
    const creado = await api.create({ nombre, activo: true })
    return creado.id
  } catch {
    const lista = await api.list()
    const existente = lista.find((x) => x.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
    if (existente) return existente.id
    throw new Error(`No se pudo crear ni encontrar "${nombre}" en el catálogo`)
  }
}

function GrupoResolver({ label, grupos, onChange, catalogo }) {
  if (grupos.length === 0) return null
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</h4>
      {grupos.map(([key, g]) => (
        <div key={key} className="flex flex-wrap items-center gap-2 border border-slate-200 rounded px-3 py-2 text-xs">
          <EstadoSimilitudBadge estado={g.estado} similar={g.similar} />
          <span className="font-mono text-slate-700">{g.textoOriginal}</span>
          <select
            className="ml-auto bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-red-600"
            value={g.accion}
            onChange={(e) => onChange(key, { accion: e.target.value })}
          >
            {g.similar && (
              <option value="usar_sugerido">
                Usar sugerido: {g.similar.texto} ({Math.round(g.similar.score * 100)}%)
              </option>
            )}
            <option value="crear_nuevo">Crear nuevo: &quot;{g.textoOriginal}&quot;</option>
            <option value="elegir">Elegir del catálogo…</option>
          </select>
          {g.accion === 'elegir' && (
            <select
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-red-600"
              value={g.catalogoId}
              onChange={(e) => onChange(key, { catalogoId: e.target.value })}
            >
              <option value="">— Elegir —</option>
              {catalogo.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  )
}

export default function ImportUsuariosModal({ open, onClose, onImported }) {
  const [state, setState] = useState(INITIAL)
  const [organizaciones, setOrganizaciones] = useState([])
  const [puestos, setPuestos] = useState([])
  const [centrosCosto, setCentrosCosto] = useState([])

  const set = (patch) => setState((s) => ({ ...s, ...patch }))

  useEffect(() => {
    if (!open) return
    organizacionesApi.list().then(setOrganizaciones).catch(() => setOrganizaciones([]))
    puestosApi.list().then(setPuestos).catch(() => setPuestos([]))
    centrosCostoApi.list().then(setCentrosCosto).catch(() => setCentrosCosto([]))
  }, [open])

  const organizacionesValidas = organizaciones.filter((o) => TIPOS_ORG_ALUMNO.includes(o.tipo))

  const handleClose = () => {
    setState(INITIAL)
    onClose()
    if (state.result?.created > 0) onImported?.()
  }

  const handleFile = (e) => {
    set({
      file: e.target.files?.[0] ?? null,
      preview: null,
      error: null,
      step: 'select',
      selected: new Set(),
      decisiones: {},
    })
  }

  const handleAnalyze = async () => {
    if (!state.file) return
    set({ loading: true, error: null })
    try {
      const preview = await importApi.previewUsuarios(state.file)
      const selected = new Set(preview.filas.filter((f) => f.estado === 'ok').map((f) => f.index))
      const decisiones = buildDecisiones(preview.filas)
      set({ preview, selected, decisiones, step: 'preview', loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  }

  const toggleRow = (index) => {
    setState((s) => {
      const next = new Set(s.selected)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return { ...s, selected: next }
    })
  }

  const updateDecision = (key, patch) => {
    setState((s) => ({ ...s, decisiones: { ...s.decisiones, [key]: { ...s.decisiones[key], ...patch } } }))
  }

  const handleConfirm = async () => {
    set({ loading: true, error: null })
    try {
      const decisionesFinal = { ...state.decisiones }

      // Crear cada catálogo nuevo UNA sola vez por grupo (ya deduplicado por
      // claveGrupo), guardando el id creado en la propia decisión.
      for (const [key, g] of Object.entries(decisionesFinal)) {
        if (g.accion !== 'crear_nuevo' || g.idCreado) continue
        const api = g.tipo === 'puesto' ? puestosApi : centrosCostoApi
        const id = await crearOResolverCatalogo(api, g.textoOriginal)
        decisionesFinal[key] = { ...g, idCreado: id }
      }

      const idResuelto = (tipo, clasif) => {
        if (!clasif) return null
        if (clasif.estado === 'duplicada') return clasif.similar.preguntaId
        const g = decisionesFinal[claveGrupo(tipo, clasif.texto)]
        if (!g) return null
        if (g.accion === 'usar_sugerido') return g.similar?.preguntaId ?? null
        if (g.accion === 'elegir') return g.catalogoId || null
        if (g.accion === 'crear_nuevo') return g.idCreado ?? null
        return null
      }

      const usuarios = []
      let faltantes = 0
      for (const f of state.preview.filas) {
        if (f.estado !== 'ok' || !state.selected.has(f.index)) continue
        const puestoId = idResuelto('puesto', f.puesto)
        const centroCostoId = idResuelto('centroCosto', f.centroCosto)
        if (!puestoId || !centroCostoId) {
          faltantes++
          continue
        }
        usuarios.push({
          dni: f.data.dni,
          nombre: f.data.nombre,
          apellido: f.data.apellido,
          ...(f.data.legajo ? { legajo: f.data.legajo } : {}),
          puestoId,
          centroCostoId,
          filaIndex: f.index,
        })
      }

      if (faltantes > 0) {
        set({
          error: `Faltan resolver ${faltantes} fila${faltantes !== 1 ? 's' : ''} — completá "Elegir del catálogo…" en Puestos/Centros a resolver.`,
          loading: false,
          decisiones: decisionesFinal,
        })
        return
      }

      const result = await importApi.confirmarUsuarios(state.organizacionId, usuarios)
      set({ result, step: 'result', loading: false, decisiones: decisionesFinal })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  }

  const { step, file, organizacionId, preview, result, loading, error, selected, decisiones } = state

  const filaPorIndex = new Map((preview?.filas ?? []).map((f) => [f.index, f]))
  const puedeImportar =
    !!preview &&
    selected.size > 0 &&
    [...selected].every((idx) => {
      const f = filaPorIndex.get(idx)
      if (!f) return false
      const gp = f.puesto?.estado === 'duplicada' ? null : decisiones[claveGrupo('puesto', f.puesto?.texto ?? '')]
      const gc = f.centroCosto?.estado === 'duplicada' ? null : decisiones[claveGrupo('centroCosto', f.centroCosto?.texto ?? '')]
      return grupoResuelto(gp) && grupoResuelto(gc)
    })

  const gruposPuesto = Object.entries(decisiones).filter(([, g]) => g.tipo === 'puesto')
  const gruposCentro = Object.entries(decisiones).filter(([, g]) => g.tipo === 'centroCosto')

  const footer = (() => {
    if (step === 'select') {
      return (
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleAnalyze} disabled={!file || !organizacionId || loading}>
            {loading ? 'Analizando…' : 'Analizar archivo'}
          </Button>
        </>
      )
    }
    if (step === 'preview') {
      return (
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !puedeImportar}>
            {loading ? 'Importando…' : `Importar ${selected.size} usuario${selected.size !== 1 ? 's' : ''}`}
          </Button>
        </>
      )
    }
    // result
    return (
      <Button onClick={handleClose}>Cerrar</Button>
    )
  })()

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar usuarios desde Excel"
      footer={footer}
    >
      <div className="space-y-4">

        {/* Estado A — selección */}
        {step === 'select' && (
          <>
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">
                Archivo .xlsx
              </label>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFile}
                className="w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white file:text-sm file:font-medium hover:file:bg-red-700 file:cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">Organización</label>
              {organizacionesValidas.length === 0 ? (
                <p className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded px-3 py-2">
                  No hay organizaciones de tipo {TIPOS_ORG_ALUMNO.join(' o ')} cargadas. Creá una
                  organización de ese tipo antes de importar usuarios.
                </p>
              ) : (
                <select
                  className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                  value={organizacionId}
                  onChange={(e) => set({ organizacionId: e.target.value })}
                >
                  <option value="">— Elegir organización —</option>
                  {organizacionesValidas.map((o) => (
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Formato esperado: columnas <strong>DNI · Nombre · Apellido · Puesto · Centro de Costo</strong> (obligatorias) y opcionalmente <strong>Legajo</strong> (encabezados en la primera fila). Todos los usuarios se importan como <strong>Alumno</strong> en la organización elegida arriba — un Excel es siempre de una sola empresa. Puesto y Centro de Costo se resuelven contra el catálogo en el siguiente paso.
            </p>
          </>
        )}

        {/* Estado B — revisión por fila + grupos a resolver */}
        {step === 'preview' && preview && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded px-3 py-2">
              <strong>{preview.totalRows}</strong> fila{preview.totalRows !== 1 ? 's' : ''} en{' '}
              <span className="font-mono text-xs">{preview.fileName}</span>. Revisá la resolución de
              Puesto/Centro de Costo antes de importar a{' '}
              <strong>{organizaciones.find((o) => String(o.id) === String(organizacionId))?.nombre}</strong>.
            </div>

            {preview.warnings?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-3 py-2 space-y-1">
                {preview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">DNI</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Nombre</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Puesto</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Centro de Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.filas.map((f) => (
                    <tr key={f.index} className={`border-b border-slate-200/70 align-top ${f.estado === 'error' ? 'bg-red-50' : ''}`}>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          disabled={f.estado === 'error'}
                          checked={selected.has(f.index)}
                          onChange={() => toggleRow(f.index)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700">{f.data.dni || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {f.data.nombre} {f.data.apellido}
                        {f.estado === 'error' && f.errores && (
                          <div className="text-[10px] text-red-600 mt-0.5">{f.errores.join(' · ')}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {f.puesto ? <EstadoSimilitudBadge estado={f.puesto.estado} similar={f.puesto.similar} /> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {f.centroCosto ? <EstadoSimilitudBadge estado={f.centroCosto.estado} similar={f.centroCosto.similar} /> : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <GrupoResolver label="Puestos a resolver" grupos={gruposPuesto} onChange={updateDecision} catalogo={puestos} />
            <GrupoResolver label="Centros de costo a resolver" grupos={gruposCentro} onChange={updateDecision} catalogo={centrosCosto} />

            <p className="text-[11px] text-slate-400">
              Filas con match exacto (badge <strong>Duplicada</strong>) se asignan automático. Las filas en rojo tienen un error bloqueante y no se importan.
            </p>
          </div>
        )}

        {/* Estado C — resultado */}
        {step === 'result' && result && (
          <div className="space-y-3">
            {result.created > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded px-3 py-2">
                ✓ <strong>{result.created}</strong> usuario{result.created !== 1 ? 's' : ''} importado{result.created !== 1 ? 's' : ''} correctamente.
              </div>
            )}

            {result.skipped > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded px-3 py-2">
                ⚠ <strong>{result.skipped}</strong> fila{result.skipped !== 1 ? 's' : ''} omitida{result.skipped !== 1 ? 's' : ''}.
              </div>
            )}

            {result.errors?.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Fila</th>
                      <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">DNI</th>
                      <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-b border-slate-200/70">
                        <td className="px-3 py-2 text-slate-700 font-mono">{e.row}</td>
                        <td className="px-3 py-2 text-slate-700 font-mono">{e.dni ?? '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{e.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.created === 0 && result.skipped === 0 && (
              <p className="text-sm text-slate-500">El archivo no contenía filas de datos.</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
            {error}
          </div>
        )}

      </div>
    </Modal>
  )
}
