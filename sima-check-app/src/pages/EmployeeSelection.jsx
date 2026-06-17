import { useState } from 'react'
import { employees } from '../data/employees'

export default function EmployeeSelection({ onSelect }) {
  const [dni, setDni] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    const trimmed = dni.trim()
    if (!trimmed) {
      setError('Ingresá tu DNI para continuar.')
      return
    }
    const emp = employees.find((e) => e.dni === trimmed)
    if (!emp) {
      setError('No se encontró ningún empleado con ese DNI. Verificá el número e intentá de nuevo.')
      return
    }
    onSelect({ id: emp.id, dni: emp.dni, name: emp.name, companyId: emp.companyId, company: emp.company })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-8">
      {/* Form */}
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
          className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-lg py-4 rounded-xl transition-colors touch-manipulation"
        >
          INGRESAR
        </button>
      </div>

      <p className="text-center text-slate-400 text-xs mt-6">Ingeniería Sima · Oil &amp; Gas</p>
    </div>
  )
}
