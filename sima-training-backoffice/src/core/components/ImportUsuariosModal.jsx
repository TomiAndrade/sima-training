import { useState } from 'react'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import { importApi } from '../api/import'

// step: 'select' | 'preview' | 'result'
const INITIAL = { step: 'select', file: null, preview: null, result: null, loading: false, error: null }

export default function ImportUsuariosModal({ open, onClose, onImported }) {
  const [state, setState] = useState(INITIAL)

  const set = (patch) => setState((s) => ({ ...s, ...patch }))

  const handleClose = () => {
    setState(INITIAL)
    onClose()
    if (state.result?.created > 0) onImported?.()
  }

  const handleFile = (e) => {
    set({ file: e.target.files?.[0] ?? null, preview: null, error: null, step: 'select' })
  }

  const handleAnalyze = async () => {
    if (!state.file) return
    set({ loading: true, error: null })
    try {
      const preview = await importApi.previewUsuarios(state.file)
      set({ preview, step: 'preview', loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  }

  const handleConfirm = async () => {
    if (!state.file) return
    set({ loading: true, error: null })
    try {
      const result = await importApi.confirmarUsuarios(state.file)
      set({ result, step: 'result', loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  }

  const { step, file, preview, result, loading, error } = state

  const footer = (() => {
    if (step === 'select') {
      return (
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleAnalyze} disabled={!file || loading}>
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
          <Button
            onClick={handleConfirm}
            disabled={loading || !preview?.totalRows}
          >
            {loading
              ? 'Importando…'
              : `Importar ${preview?.totalRows ?? 0} usuario${preview?.totalRows !== 1 ? 's' : ''}`}
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
            <p className="text-xs text-slate-400">
              Formato esperado: columnas <strong>DNI · Nombre · Apellido · Email · Empresa</strong> (encabezados en la primera fila).
            </p>
          </>
        )}

        {/* Estado B — preview */}
        {step === 'preview' && preview && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded px-3 py-2">
              Se importarán <strong>{preview.totalRows}</strong> usuario{preview.totalRows !== 1 ? 's' : ''} desde{' '}
              <span className="font-mono text-xs">{preview.fileName}</span>.
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
              <span>Hoja: <strong className="text-slate-900">{preview.sheetName}</strong></span>
              <span>Columnas: <strong className="text-slate-900">{preview.totalColumns}</strong></span>
              <span>Filas: <strong className="text-slate-900">{preview.totalRows}</strong></span>
            </div>

            {preview.warnings?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-3 py-2 space-y-1">
                {preview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {preview.headers.map((h, i) => (
                      <th key={i} className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-200/70">
                      {preview.headers.map((h, ci) => (
                        <td key={ci} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                          {String(row[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-400">
              Mostrando hasta 10 filas de muestra. Confirmá para importar las {preview.totalRows} filas.
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
