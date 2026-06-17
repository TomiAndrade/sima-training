import { useState, useMemo } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { trainingAssignments as initialAssignments } from '../data/training-assignments'
import { employees } from '../../core/data/employees'
import { trainingModules as modules } from '../data/training-modules'
import { companies } from '../../core/data/companies'
import { users } from '../../core/data/users'

const statusBadge = {
  pending: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-600 border border-amber-200' },
  completed: { label: 'Completada', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  expired: { label: 'Vencida', cls: 'bg-slate-100 text-slate-500 border border-slate-200' },
}

// Usuario simulado — cambiar id para probar distintos roles
const CURRENT_USER = users.find((u) => u.id === 1)

export default function TrainingAssignments() {
  const isCoord = CURRENT_USER.role === 'coordinador'

  const [assignments, setAssignments] = useState(initialAssignments)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ employeeId: null, moduleId: modules[0]?.id ?? 1 })
  const [empSearch, setEmpSearch] = useState('')
  const [empCompany, setEmpCompany] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const getEmployee = (id) => employees.find((e) => e.id === id)
  const getCompanyName = (id) => companies.find((c) => c.id === id)?.name ?? '—'
  const getModuleName = (id) => modules.find((m) => m.id === id)?.name ?? '—'
  const getAssignedBy = (id) => users.find((u) => u.id === id)?.name ?? '—'

  const openCreate = () => {
    setForm({ employeeId: null, moduleId: modules[0]?.id ?? 1 })
    setEmpSearch('')
    setEmpCompany('')
    setError('')
    setModal(true)
  }

  const handleSave = () => {
    if (!form.employeeId) {
      setError('Seleccioná un empleado.')
      return
    }
    const duplicate = assignments.some(
      (a) => a.employeeId === form.employeeId && a.moduleId === form.moduleId
    )
    if (duplicate) {
      setError('Este empleado ya tiene ese módulo asignado.')
      return
    }
    setAssignments((prev) => [
      ...prev,
      {
        id: Date.now(),
        employeeId: form.employeeId,
        moduleId: form.moduleId,
        assignedBy: 1,
        assignedAt: new Date().toISOString().split('T')[0],
        status: 'pending',
      },
    ])
    setModal(null)
  }

  const columns = [
    {
      key: 'employeeId',
      label: 'Empleado',
      render: (id) => (
        <span className="text-slate-900 font-medium">{getEmployee(id)?.name ?? '—'}</span>
      ),
    },
    {
      key: '_empresa',
      label: 'Empresa',
      render: (_, row) => (
        <span className="text-slate-600">{getCompanyName(getEmployee(row.employeeId)?.companyId)}</span>
      ),
    },
    {
      key: 'moduleId',
      label: 'Módulo',
      render: (id) => <span className="text-slate-600">{getModuleName(id)}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      render: (val) => {
        const s = statusBadge[val] ?? { label: val, cls: 'bg-slate-100 text-slate-500 border border-slate-200' }
        return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
      },
    },
    {
      key: 'assignedBy',
      label: 'Asignado por',
      render: (id) => <span className="text-slate-500 text-sm">{getAssignedBy(id)}</span>,
    },
    {
      key: 'assignedAt',
      label: 'Fecha',
      render: (val) => <span className="text-slate-500 text-sm">{val}</span>,
    },
  ]

  const filteredEmployeesForModal = useMemo(() => {
    const companyId = isCoord ? CURRENT_USER.companyId : (empCompany ? Number(empCompany) : null)
    const q = empSearch.trim().toLowerCase()
    return employees.filter((e) => {
      if (companyId && e.companyId !== companyId) return false
      if (q && !e.name.toLowerCase().includes(q) && !e.dni.includes(q)) return false
      return true
    })
  }, [empSearch, empCompany, isCoord])

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assignments.filter((a) => {
      const emp = getEmployee(a.employeeId)
      if (!emp) return false
      if (q && !emp.name.toLowerCase().includes(q) && !emp.dni.includes(q)) return false
      if (filterCompany && emp.companyId !== Number(filterCompany)) return false
      if (filterStatus && a.status !== filterStatus) return false
      return true
    })
  }, [assignments, search, filterCompany, filterStatus])

  const pending = assignments.filter((a) => a.status === 'pending').length
  const completed = assignments.filter((a) => a.status === 'completed').length

  const selectCls = 'bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-red-600'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Asignaciones</h2>
          <p className="text-slate-500 text-sm">
            {filteredAssignments.length} de {assignments.length} · {pending} pendientes · {completed} completadas
          </p>
        </div>
        <Button onClick={openCreate}>+ Nueva asignación</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o DNI…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-red-600 w-64"
        />
        <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className={selectCls}>
          <option value="">Todas las empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="completed">Completada</option>
          <option value="expired">Vencida</option>
        </select>
        {(search || filterCompany || filterStatus) && (
          <button
            onClick={() => { setSearch(''); setFilterCompany(''); setFilterStatus('') }}
            className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <Table columns={columns} data={filteredAssignments} />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title="Nueva asignación"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest">Empleado</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar por nombre o DNI…"
                value={empSearch}
                onChange={(e) => { setEmpSearch(e.target.value); setError('') }}
                className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-red-600"
              />
              {!isCoord && (
                <select
                  value={empCompany}
                  onChange={(e) => { setEmpCompany(e.target.value); setError('') }}
                  className="bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-red-600"
                >
                  <option value="">Todas las empresas</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div className="border border-slate-200 rounded overflow-hidden max-h-44 overflow-y-auto">
              {filteredEmployeesForModal.length === 0 ? (
                <div className="px-3 py-4 text-slate-400 text-sm text-center">Sin resultados</div>
              ) : filteredEmployeesForModal.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, employeeId: e.id })); setError('') }}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 transition-colors ${
                    form.employeeId === e.id
                      ? 'bg-red-50 text-red-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium truncate">{e.name}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-slate-400 font-mono text-xs">{e.dni}</span>
                    {!isCoord && <span className="text-slate-400 text-xs">{getCompanyName(e.companyId)}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-slate-600 text-sm font-medium mb-1">Módulo</label>
            <select
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={form.moduleId}
              onChange={(e) => { setForm((f) => ({ ...f, moduleId: Number(e.target.value) })); setError('') }}
            >
              {modules.filter((m) => m.active).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      </Modal>
    </div>
  )
}
