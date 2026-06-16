import { useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { trainingModules as initialModules } from '../data/training-modules'

export default function TrainingModules() {
  const [modules, setModules] = useState(initialModules)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', active: true })

  const openCreate = () => {
    setForm({ name: '', active: true })
    setModal({ mode: 'create' })
  }

  const openEdit = (mod) => {
    setForm({ name: mod.name, active: mod.active })
    setModal({ mode: 'edit', data: mod })
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (modal.mode === 'create') {
      setModules((prev) => [...prev, { id: Date.now(), questions: [], ...form }])
    } else {
      setModules((prev) => prev.map((m) => m.id === modal.data.id ? { ...m, ...form } : m))
    }
    setModal(null)
  }

  const toggleActive = (id) => {
    setModules((prev) => prev.map((m) => m.id === id ? { ...m, active: !m.active } : m))
  }

  const columns = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'active',
      label: 'Estado',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600 text-slate-400'}`}>
          {val ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'questions',
      label: 'Preguntas',
      render: (questions) => <span className="text-slate-300">{questions.length}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Capacitaciones</h2>
          <p className="text-slate-400 text-sm">{modules.length} módulos · {modules.filter((m) => m.active).length} activos</p>
        </div>
        <Button onClick={openCreate}>+ Nuevo módulo</Button>
      </div>

      <Table
        columns={columns}
        data={modules}
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
        title={modal?.mode === 'create' ? 'Nuevo módulo' : 'Editar módulo'}
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
              placeholder="Nombre del módulo"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-slate-300 text-sm font-medium">Estado</label>
            <button
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-red-600' : 'bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-slate-400 text-sm">{form.active ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
