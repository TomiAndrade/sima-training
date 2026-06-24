import { useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { clients as initialClients } from '../data/clients'
import { users } from '../data/users'

export default function Clients() {
  const [clients, setClients] = useState(initialClients)
  const [modal, setModal] = useState(null) // null | { mode: 'create'|'edit', data }
  const [form, setForm] = useState({ name: '', active: true })

  const openCreate = () => {
    setForm({ name: '', active: true })
    setModal({ mode: 'create' })
  }

  const openEdit = (client) => {
    setForm({ name: client.name, active: client.active })
    setModal({ mode: 'edit', data: client })
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (modal.mode === 'create') {
      setClients((prev) => [...prev, { id: Date.now(), ...form }])
    } else {
      setClients((prev) => prev.map((c) => c.id === modal.data.id ? { ...c, ...form } : c))
    }
    setModal(null)
  }

  const toggleActive = (id) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, active: !c.active } : c))
  }

  const getUserCount = (clientId) => users.filter((u) => u.clientId === clientId).length

  const columns = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'active',
      label: 'Estado',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {val ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Usuarios',
      render: (id) => <span className="text-slate-700">{getUserCount(id)}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Clientes</h2>
          <p className="text-slate-400 text-sm">{clients.length} clientes registrados</p>
        </div>
        <Button onClick={openCreate}>+ Nuevo cliente</Button>
      </div>

      <Table
        columns={columns}
        data={clients}
        actions={(row) => (
          <>
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Editar</Button>
            <Button variant={row.active ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActive(row.id)}>
              {row.active ? 'Desactivar' : 'Activar'}
            </Button>
          </>
        )}
      />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Nombre</label>
            <input
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre del cliente"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-slate-700 text-sm font-medium">Estado</label>
            <button
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-red-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-slate-400 text-sm">{form.active ? 'Activa' : 'Inactiva'}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
