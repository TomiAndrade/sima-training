import { useState } from 'react'
import Table from '../components/Table'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { assignments as initialAssignments } from '../data/assignments'
import { employees } from '../data/employees'
import { modules } from '../data/modules'
import { companies } from '../data/companies'
import { users } from '../data/users'

const statusBadge = {
  pending: { label: 'Pendiente', cls: 'bg-amber-500/20 text-amber-400' },
  completed: { label: 'Completada', cls: 'bg-emerald-500/20 text-emerald-400' },
  expired: { label: 'Vencida', cls: 'bg-slate-500/20 text-slate-400' },
}

export default function Assignments() {
  const [assignments, setAssignments] = useState(initialAssignments)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ employeeId: employees[0]?.id ?? 1, moduleId: modules[0]?.id ?? 1 })
  const [error, setError] = useState('')

  const getEmployee = (id) => employees.find((e) => e.id === id)
  const getCompanyName = (id) => companies.find((c) => c.id === id)?.name ?? '—'
  const getModuleName = (id) => modules.find((m) => m.id === id)?.name ?? '—'
  const getAssignedBy = (id) => users.find((u) => u.id === id)?.name ?? '—'

  const openCreate = () => {
    setForm({ employeeId: employees[0]?.id ?? 1, moduleId: modules[0]?.id ?? 1 })
    setError('')
    setModal(true)
  }

  const handleSave = () => {
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
        <span className="text-slate-100 font-medium">{getEmployee(id)?.name ?? '—'}</span>
      ),
    },
    {
      key: '_empresa',
      label: 'Empresa',
      render: (_, row) => (
        <span className="text-slate-300">{getCompanyName(getEmployee(row.employeeId)?.companyId)}</span>
      ),
    },
    {
      key: 'moduleId',
      label: 'Módulo',
      render: (id) => <span className="text-slate-300">{getModuleName(id)}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      render: (val) => {
        const s = statusBadge[val] ?? { label: val, cls: 'bg-slate-500/20 text-slate-400' }
        return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
      },
    },
    {
      key: 'assignedBy',
      label: 'Asignado por',
      render: (id) => <span className="text-slate-400 text-sm">{getAssignedBy(id)}</span>,
    },
    {
      key: 'assignedAt',
      label: 'Fecha',
      render: (val) => <span className="text-slate-400 text-sm">{val}</span>,
    },
  ]

  const pending = assignments.filter((a) => a.status === 'pending').length
  const completed = assignments.filter((a) => a.status === 'completed').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Asignaciones</h2>
          <p className="text-slate-400 text-sm">
            {assignments.length} total · {pending} pendientes · {completed} completadas
          </p>
        </div>
        <Button onClick={openCreate}>+ Nueva asignación</Button>
      </div>

      <Table columns={columns} data={assignments} />

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
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Empleado</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
              value={form.employeeId}
              onChange={(e) => { setForm((f) => ({ ...f, employeeId: Number(e.target.value) })); setError('') }}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {getCompanyName(e.companyId)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Módulo</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
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
