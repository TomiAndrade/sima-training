import { useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { companies as initialCompanies } from '../data/companies'
import { users } from '../data/users'

export default function Companies() {
  const [companies, setCompanies] = useState(initialCompanies)
  const [modal, setModal] = useState(null) // null | { mode: 'create'|'edit', data }
  const [form, setForm] = useState({ name: '', active: true })

  const openCreate = () => {
    setForm({ name: '', active: true })
    setModal({ mode: 'create' })
  }

  const openEdit = (company) => {
    setForm({ name: company.name, active: company.active })
    setModal({ mode: 'edit', data: company })
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (modal.mode === 'create') {
      setCompanies((prev) => [...prev, { id: Date.now(), ...form }])
    } else {
      setCompanies((prev) => prev.map((c) => c.id === modal.data.id ? { ...c, ...form } : c))
    }
    setModal(null)
  }

  const toggleActive = (id) => {
    setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, active: !c.active } : c))
  }

  const getUserCount = (companyId) => users.filter((u) => u.companyId === companyId).length

  const columns = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'active',
      label: 'Estado',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-slate-400'}`}>
          {val ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
    {
      key: 'id',
      label: 'Usuarios',
      render: (id) => <span className="text-slate-300">{getUserCount(id)}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Empresas</h2>
          <p className="text-slate-400 text-sm">{companies.length} empresas registradas</p>
        </div>
        <Button onClick={openCreate}>+ Nueva empresa</Button>
      </div>

      <Table
        columns={columns}
        data={companies}
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
        title={modal?.mode === 'create' ? 'Nueva empresa' : 'Editar empresa'}
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
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre de la empresa"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-slate-300 text-sm font-medium">Estado</label>
            <button
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-red-600' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-slate-400 text-sm">{form.active ? 'Activa' : 'Inactiva'}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
