import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import { importApi } from '../api/import'
import { modulosApi } from '../api/modulos'
import { backendTypeBadge } from '../../sima-check/components/bancoModulo'

// step: 'select' | 'preview' | 'result'
const INITIAL = {
  step: 'select',
  file: null,
  moduloId: '',
  preview: null,
  result: null,
  loading: false,
  error: null,
  selected: new Set(),
}

function estadoSimBadge(estado, similar) {
  const map = {
    nueva: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    parecida: 'bg-amber-50 text-amber-600 border-amber-200',
    duplicada: 'bg-red-50 text-red-600 border-red-200',
    error: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  const label =
    estado === 'parecida' && similar
      ? `Parecida ${Math.round(similar.score * 100)}%`
      : estado === 'nueva'
        ? 'Nueva'
        : estado === 'duplicada'
          ? 'Duplicada'
          : 'Error'
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${map[estado]}`}>
      {label}
    </span>
  )
}

export default function ImportPreguntasModal({ open, onClose, onImported }) {
  const [state, setState] = useState(INITIAL)
  const [modules, setModules] = useState([])

  const set = (patch) => setState((s) => ({ ...s, ...patch }))

  useEffect(() => {
    if (open) modulosApi.list().then(setModules).catch(() => setModules([]))
  }, [open])

  const handleClose = () => {
    const imported = state.result?.created > 0
    setState(INITIAL)
    onClose()
    if (imported) onImported?.()
  }

  const handleFile = (e) => {
    set({ file: e.target.files?.[0] ?? null, preview: null, error: null, step: 'select', selected: new Set() })
  }

  const handleAnalyze = async () => {
    if (!state.file) return
    set({ loading: true, error: null })
    try {
      const preview = await importApi.previewPreguntas(state.file)
      // Por default se seleccionan solo las preguntas nuevas; las parecidas y
      // duplicadas quedan destildadas (el usuario decide); las de error, fuera.
      const selected = new Set(
        preview.filas.filter((f) => f.estado === 'nueva').map((f) => f.index),
      )
      set({ preview, selected, step: 'preview', loading: false })
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

  const handleConfirm = async () => {
    const preguntas = state.preview.filas
      .filter((f) => f.estado !== 'error' && state.selected.has(f.index))
      .map((f) => f.data)
    if (preguntas.length === 0) return
    set({ loading: true, error: null })
    try {
      const result = await importApi.confirmarPreguntas(preguntas, state.moduloId)
      set({ result, step: 'result', loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  }

  const { step, file, moduloId, preview, result, loading, error, selected } = state

  const seleccionables = preview?.filas.filter((f) => f.estado !== 'error') ?? []
  const nSel = seleccionables.filter((f) => selected.has(f.index)).length

  const footer = (() => {
    if (step === 'select') {
      return (
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleAnalyze} disabled={!file || loading}>
            {loading ? 'Analizando…' : 'Analizar archivo'}
          </Button>
        </>
      )
    }
    if (step === 'preview') {
      return (
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading || nSel === 0}>
            {loading ? 'Importando…' : `Importar ${nSel} pregunta${nSel !== 1 ? 's' : ''}`}
          </Button>
        </>
      )
    }
    return <Button onClick={handleClose}>Cerrar</Button>
  })()

  const moduloDestino = modules.find((m) => m.id === moduloId)

  return (
    <Modal open={open} onClose={handleClose} title="Importar preguntas desde Excel" footer={footer}>
      <div className="space-y-4">

        {/* A — selección */}
        {step === 'select' && (
          <>
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">Archivo .xlsx</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFile}
                className="w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-red-600 file:text-white file:text-sm file:font-medium hover:file:bg-red-700 file:cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1">Módulo destino <span className="font-normal text-slate-400">(opcional)</span></label>
              <select
                className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                value={moduloId}
                onChange={(e) => set({ moduloId: e.target.value })}
              >
                <option value="">— Sin asignar (solo al banco) —</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <p className="text-xs text-slate-400">
              Formato esperado: columnas <strong>enunciado · tipo · opcion_a…d · respuesta_correcta · puntaje · imagen</strong> (encabezados en la primera fila). Tipos: V/F, múltiple, imagen, texto libre.
            </p>
          </>
        )}

        {/* B — preview con checkboxes */}
        {step === 'preview' && preview && (
          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded px-3 py-2">
              <strong>{preview.totalRows}</strong> fila{preview.totalRows !== 1 ? 's' : ''} en{' '}
              <span className="font-mono text-xs">{preview.fileName}</span>. Elegí cuáles importar
              {moduloDestino ? <> a <strong>{moduloDestino.nombre}</strong></> : ' al banco'}.
            </div>

            {preview.warnings?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-3 py-2 space-y-1">
                {preview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 sticky top-0">
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Enunciado</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Tipo</th>
                    <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.filas.map((f) => (
                    <tr key={f.index} className="border-b border-slate-200/70 align-top">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          disabled={f.estado === 'error'}
                          checked={selected.has(f.index)}
                          onChange={() => toggleRow(f.index)}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-700 max-w-xs">
                        <span className="line-clamp-2">{f.data.texto || <span className="text-slate-400">(sin enunciado)</span>}</span>
                      </td>
                      <td className="px-3 py-2">
                        {f.data.tipo ? backendTypeBadge(f.data.tipo) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 space-y-1">
                        {estadoSimBadge(f.estado, f.similar)}
                        {f.estado === 'parecida' && f.similar && (
                          <div className="text-[10px] text-slate-400 line-clamp-1">≈ {f.similar.texto}</div>
                        )}
                        {f.estado === 'error' && f.errores && (
                          <div className="text-[10px] text-red-500">{f.errores.join(' · ')}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-400">
              Las <strong>nuevas</strong> vienen tildadas; las <strong>parecidas</strong> y <strong>duplicadas</strong> destildadas (revisá antes de importar). Las filas con <strong>error</strong> no se pueden importar.
            </p>
          </div>
        )}

        {/* C — resultado */}
        {step === 'result' && result && (
          <div className="space-y-3">
            {result.created > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded px-3 py-2">
                ✓ <strong>{result.created}</strong> pregunta{result.created !== 1 ? 's' : ''} importada{result.created !== 1 ? 's' : ''}
                {moduloDestino ? <> y asignada{result.created !== 1 ? 's' : ''} a <strong>{moduloDestino.nombre}</strong></> : ' al banco'}.
              </div>
            )}
            {result.errors?.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Enunciado</th>
                      <th className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-b border-slate-200/70">
                        <td className="px-3 py-2 text-slate-700 max-w-xs"><span className="line-clamp-1">{e.texto}</span></td>
                        <td className="px-3 py-2 text-slate-600">{e.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.created === 0 && (result.errors?.length ?? 0) === 0 && (
              <p className="text-sm text-slate-500">No se importó ninguna pregunta.</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">{error}</div>
        )}

      </div>
    </Modal>
  )
}
