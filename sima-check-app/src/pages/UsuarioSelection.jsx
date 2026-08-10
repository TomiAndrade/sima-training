import { useState } from 'react'
import { tabletApi } from '../core/api/tablet'
import { setToken } from '../core/api/client'

export default function UsuarioSelection({ onSelect }) {
  const [dni, setDni] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const trimmed = dni.trim()
    if (!trimmed) {
      setError('Ingresá tu DNI para continuar.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const { access_token, usuario } = await tabletApi.login(trimmed)
      setToken(access_token)
      // El login real sólo devuelve id/nombre/apellido — `name` se deriva acá
      // para que ModuleSelection.jsx (todavía sobre datos mock hasta el
      // commit 2) siga pudiendo hacer usuario.name.split(' ') sin romperse.
      onSelect({
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        name: `${usuario.nombre} ${usuario.apellido}`.trim(),
      })
    } catch (err) {
      if (err.status === 401) {
        setError('No se encontró ningún usuario con ese DNI. Verificá el número e intentá de nuevo.')
      } else if (err.status === undefined) {
        setError('No hay conexión con el servidor. Intentá de nuevo en un momento.')
      } else {
        setError('Ocurrió un error inesperado. Intentá de nuevo.')
      }
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleSubmit()
  }

  return (
    <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-8">
      <div className="space-y-5">
        <div>
          <label className="block text-slate-700 text-lg font-bold mb-2 text-center">
            Ingrese su DNI
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            placeholder="Solo números, sin puntos"
            value={dni}
            onChange={(e) => {
              setDni(e.target.value.replace(/\D/g, ''))
              setError('')
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-4 text-slate-900 text-2xl text-center tracking-widest font-mono focus:outline-none focus:border-red-600 transition-colors placeholder:text-slate-400 placeholder:text-base placeholder:tracking-normal"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3">
            <p className="text-red-600 text-sm text-center leading-snug">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl transition-colors touch-manipulation"
        >
          {loading ? 'INGRESANDO...' : 'INGRESAR'}
        </button>
      </div>

      <p className="text-center text-slate-400 text-xs mt-6">Ingeniería Sima · Oil &amp; Gas</p>
    </div>
  )
}
