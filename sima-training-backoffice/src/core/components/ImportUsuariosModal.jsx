import { useState } from 'react'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import { importApi } from '../api/import'

export default function ImportUsuariosModal({ open, onClose }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setError(null)
    setLoading(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = (e) => {
    setError(null)
    setPreview(null)
    setFile(e.target.files?.[0] ?? null)
  }

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await importApi.previewUsuarios(file)
      setPreview(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar usuarios desde Excel"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cerrar
          </Button>
          <Button onClick={handleAnalyze} disabled={!file || loading}>
            {loading ? 'Analizando…' : 'Analizar archivo'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-3 py-2">
          <strong>Vista previa.</strong> Esto analiza el archivo y muestra lo que
          detecta, pero <strong>no importa nada todavía</strong>. El mapeo de
          columnas y la carga definitiva se habilitan cuando se defina el formato
          de Excel de nómina.
        </div>

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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
            {error}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
              <span>
                Hoja: <strong className="text-slate-900">{preview.sheetName}</strong>
              </span>
              <span>
                Columnas:{' '}
                <strong className="text-slate-900">{preview.totalColumns}</strong>
              </span>
              <span>
                Filas de datos:{' '}
                <strong className="text-slate-900">{preview.totalRows}</strong>
              </span>
            </div>

            {preview.warnings?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-3 py-2 space-y-1">
                {preview.warnings.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {preview.headers.map((h, i) => (
                      <th
                        key={i}
                        className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide whitespace-nowrap"
                      >
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
              Mostrando hasta 10 filas de muestra. Total detectado:{' '}
              {preview.totalRows} filas — sin persistir.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
