import { useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { trainingModules as modules } from '../data/training-modules'

const EMPTY_FORM = { moduleId: 1, type: 'truefalse', statement: '', options: ['', '', '', ''], correctAnswer: '' }

export default function Questions() {
  const allQuestions = modules.flatMap((m) => m.questions.map((q) => ({ ...q, moduleId: m.id, moduleName: m.name })))
  const [questions, setQuestions] = useState(allQuestions)
  const [filterModule, setFilterModule] = useState('all')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const filtered = filterModule === 'all' ? questions : questions.filter((q) => q.moduleId === Number(filterModule))

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, moduleId: modules[0]?.id ?? 1 })
    setModal({ mode: 'create' })
  }

  const openEdit = (q) => {
    setForm({
      moduleId: q.moduleId,
      type: q.type,
      statement: q.statement,
      options: q.options ? [...q.options] : ['', '', '', ''],
      correctAnswer: q.correctAnswer,
    })
    setModal({ mode: 'edit', data: q })
  }

  const handleSave = () => {
    if (!form.statement.trim() || !form.correctAnswer) return
    const modName = modules.find((m) => m.id === Number(form.moduleId))?.name ?? ''
    const base = {
      moduleId: Number(form.moduleId),
      moduleName: modName,
      type: form.type,
      statement: form.statement,
      correctAnswer: form.correctAnswer,
      options: form.type === 'multiple' ? form.options.filter(Boolean) : undefined,
    }
    if (modal.mode === 'create') {
      setQuestions((prev) => [...prev, { id: Date.now(), ...base }])
    } else {
      setQuestions((prev) => prev.map((q) => q.id === modal.data.id ? { ...q, ...base } : q))
    }
    setModal(null)
  }

  const typeBadge = (type) => (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${type === 'truefalse' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
      {type === 'truefalse' ? 'V/F' : 'Múltiple'}
    </span>
  )

  const columns = [
    { key: 'statement', label: 'Enunciado', render: (v) => <span className="text-slate-200 line-clamp-2 max-w-xs">{v}</span> },
    { key: 'type', label: 'Tipo', render: typeBadge },
    { key: 'moduleName', label: 'Módulo', render: (v) => <span className="text-slate-400 text-xs">{v}</span> },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-bold text-xl">Preguntas</h2>
          <p className="text-slate-400 text-sm">{filtered.length} preguntas</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
          >
            <option value="all">Todos los módulos</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Button onClick={openCreate}>+ Nueva pregunta</Button>
        </div>
      </div>

      <Table
        columns={columns}
        data={filtered}
        actions={(row) => (
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Editar</Button>
        )}
      />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'Nueva pregunta' : 'Editar pregunta'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">Módulo</label>
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
                value={form.moduleId}
                onChange={(e) => setForm((f) => ({ ...f, moduleId: Number(e.target.value) }))}
              >
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">Tipo</label>
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, correctAnswer: '' }))}
              >
                <option value="truefalse">Verdadero / Falso</option>
                <option value="multiple">Opción múltiple</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Enunciado</label>
            <textarea
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600 resize-none"
              value={form.statement}
              onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="Escribí la pregunta aquí..."
            />
          </div>
          {form.type === 'multiple' && (
            <div className="space-y-2">
              <label className="block text-slate-300 text-sm font-medium">Opciones</label>
              {['a', 'b', 'c', 'd'].map((letter, i) => (
                <div key={letter} className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm w-4">{letter})</span>
                  <input
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-red-600"
                    value={form.options[i]}
                    onChange={(e) => {
                      const opts = [...form.options]
                      opts[i] = e.target.value
                      setForm((f) => ({ ...f, options: opts }))
                    }}
                    placeholder={`Opción ${letter}`}
                  />
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1">Respuesta correcta</label>
            {form.type === 'truefalse' ? (
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
                value={form.correctAnswer}
                onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))}
              >
                <option value="">Seleccioná...</option>
                <option value="Verdadero">Verdadero</option>
                <option value="Falso">Falso</option>
              </select>
            ) : (
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600"
                value={form.correctAnswer}
                onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))}
              >
                <option value="">Seleccioná la opción correcta...</option>
                {form.options.filter(Boolean).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
              </select>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
