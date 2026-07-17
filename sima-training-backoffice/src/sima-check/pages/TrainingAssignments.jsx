import { useState, useMemo } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { trainingAssignments as initialAssignments } from '../data/training-assignments'
import { usuariosMock } from '../../core/data/usuarios-mock'
import { trainingModules as modules } from '../data/training-modules'
import { clients } from '../../core/data/clients'
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
  const [form, setForm] = useState({ usuarioId: null, moduleId: modules[0]?.id ?? 1 })
  const [usuarioSearch, setUsuarioSearch] = useState('')
  const [usuarioClient, setUsuarioClient] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const getUsuario = (id) => usuariosMock.find((u) => u.id === id)
  const getClientName = (id) => clients.find((c) => c.id === id)?.name ?? '—'
  const getModuleName = (id) => modules.find((m) => m.id === id)?.name ?? '—'
  const getAssignedBy = (id) => users.find((u) => u.id === id)?.name ?? '—'

  const openCreate = () => {
    setForm({ usuarioId: null, moduleId: modules[0]?.id ?? 1 })
    setUsuarioSearch('')
    setUsuarioClient('')
    setError('')
    setModal(true)
  }

  const handleSave = () => {
    if (!form.usuarioId) {
      setError('Seleccioná un usuario.')
      return
    }
    const duplicate = assignments.some(
      (a) => a.usuarioId === form.usuarioId && a.moduleId === form.moduleId
    )
    if (duplicate) {
      setError('Este usuario ya tiene ese módulo asignado.')
      return
    }
    setAssignments((prev) => [
      ...prev,
      {
        id: Date.now(),
        usuarioId: form.usuarioId,
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
      key: 'usuarioId',
      label: 'Usuario',
      render: (id) => (
        <span className="text-slate-900 font-medium">{getUsuario(id)?.name ?? '—'}</span>
      ),
    },
    {
      key: '_cliente',
      label: 'Cliente',
      render: (_, row) => (
        <span className="text-slate-600">{getClientName(getUsuario(row.usuarioId)?.clientId)}</span>
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

  const filteredUsuariosForModal = useMemo(() => {
    const clientId = isCoord ? CURRENT_USER.clientId : (usuarioClient ? Number(usuarioClient) : null)
    const q = usuarioSearch.trim().toLowerCase()
    return usuariosMock.filter((u) => {
      if (clientId && u.clientId !== clientId) return false
      if (q && !u.name.toLowerCase().includes(q) && !u.dni.includes(q)) return false
      return true
    })
  }, [usuarioSearch, usuarioClient, isCoord])

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assignments.filter((a) => {
      const u = getUsuario(a.usuarioId)
      if (!u) return false
      if (q && !u.name.toLowerCase().includes(q) && !u.dni.includes(q)) return false
      if (filterClient && u.clientId !== Number(filterClient)) return false
      if (filterStatus && a.status !== filterStatus) return false
      return true
    })
  }, [assignments, search, filterClient, filterStatus])

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
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className={selectCls}>
          <option value="">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="completed">Completada</option>
          <option value="expired">Vencida</option>
        </select>
        {(search || filterClient || filterStatus) && (
          <button
            onClick={() => { setSearch(''); setFilterClient(''); setFilterStatus('') }}
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
            <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest">Usuario</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar por nombre o DNI…"
                value={usuarioSearch}
                onChange={(e) => { setUsuarioSearch(e.target.value); setError('') }}
                className="flex-1 bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-red-600"
              />
              {!isCoord && (
                <select
                  value={usuarioClient}
                  onChange={(e) => { setUsuarioClient(e.target.value); setError('') }}
                  className="bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-red-600"
                >
                  <option value="">Todos los clientes</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div className="border border-slate-200 rounded overflow-hidden max-h-44 overflow-y-auto">
              {filteredUsuariosForModal.length === 0 ? (
                <div className="px-3 py-4 text-slate-400 text-sm text-center">Sin resultados</div>
              ) : filteredUsuariosForModal.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, usuarioId: u.id })); setError('') }}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-3 border-b border-slate-100 last:border-0 transition-colors ${
                    form.usuarioId === u.id
                      ? 'bg-red-50 text-red-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium truncate">{u.name}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-slate-400 font-mono text-xs">{u.dni}</span>
                    {!isCoord && <span className="text-slate-400 text-xs">{getClientName(u.clientId)}</span>}
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
