import { useState } from 'react'
import Table from '../components/Table'
import Button from '../components/Button'
import Modal from '../components/Modal'
import { users as initialUsers } from '../data/users'
import { companies } from '../data/companies'

const ROLES = ['admin', 'supervisor', 'empleado']

const roleBadge = {
  admin: 'bg-red-600/20 text-red-400',
  supervisor: 'bg-blue-500/20 text-blue-400',
  empleado: 'bg-slate-500/20 text-slate-300',
}

export default function Users() {
  const [users, setUsers] = useState(initialUsers)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', role: 'empleado', companyId: 1 })

  const getCompanyName = (id) => companies.find((c) => c.id === id)?.name ?? '—'

  const openCreate = () => {
    setForm({ name: '', role: 'empleado', companyId: companies[0]?.id ?? 1 })
    setModal({ mode: 'create' })
  }

  const openEdit = (user) => {
    setForm({ name: user.name, role: user.role, companyId: user.companyId })
    setModal({ mode: 'edit', data: user })
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (modal.mode === 'create') {
      setUsers((prev) => [...prev, { id: Date.now(), ...form }])
    } else {
      setUsers((prev) => prev.map((u) => u.id === modal.data.id ? { ...u, ...form } : u))
    }
    setModal(null)
  }

  const columns = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'role',
      label: 'Rol',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${roleBadge[val]}`}>{val}</span>
      ),
    },
    { key: 'companyId', label: 'Empresa', render: (id) => <span className="text-slate-300">{getCompanyName(id)}</span> },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Usuarios</h2>
          <p className="text-slate-400 text-sm">{users.length} usuarios registrados</p>
        </div>
        <Button onClick={openCreate}>+ Nuevo usuario</Button>
      </div>

      <Table
        columns={columns}
        data={users}
        actions={(row) => (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Editar</Button>
          </>
        )}
      />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Nombre</label>
            <input
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre completo"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Rol</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Empresa</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
              value={form.companyId}
              onChange={(e) => setForm((f) => ({ ...f, companyId: Number(e.target.value) }))}
            >
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
