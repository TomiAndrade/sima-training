import { useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { trainingModules as modules } from '../data/training-modules'

const EMPTY_FORM = { type: 'truefalse', statement: '', options: ['', '', '', ''], correctAnswer: '' }

const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-red-600'

function typeBadge(type) {
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold font-mono border ${type === 'truefalse' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' : 'bg-violet-500/10 text-violet-400 border-violet-500/30'}`}>
      {type === 'truefalse' ? 'V / F' : 'Múltiple'}
    </span>
  )
}

function ModuleSelector({ onSelect }) {
  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <div className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-1">Preguntas</div>
        <p className="text-zinc-400 text-sm">Seleccioná un módulo para ver y editar sus preguntas.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {modules.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="text-left bg-zinc-900 border border-zinc-800 rounded p-5 relative overflow-hidden hover:bg-zinc-800/50 hover:border-zinc-700 transition-colors duration-150 group"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-red-600/60" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white font-semibold text-sm mb-1 group-hover:text-zinc-100">{m.name}</div>
                <div className="text-zinc-500 text-xs font-mono">{m.questions.length} preguntas</div>
              </div>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold font-mono border uppercase tracking-wider ${m.active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                {m.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="mt-4 text-zinc-600 text-[10px] font-mono uppercase tracking-widest group-hover:text-zinc-500 transition-colors">
              Ver preguntas →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function QuestionsTable({ moduleId, onBack }) {
  const module = modules.find((m) => m.id === moduleId)
  const [questions, setQuestions] = useState(module.questions)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setModal({ mode: 'create' })
  }

  const openEdit = (q) => {
    setForm({
      type: q.type,
      statement: q.statement,
      options: q.options ? [...q.options] : ['', '', '', ''],
      correctAnswer: q.correctAnswer,
    })
    setModal({ mode: 'edit', data: q })
  }

  const handleSave = () => {
    if (!form.statement.trim() || !form.correctAnswer) return
    const base = {
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

  const columns = [
    { key: 'statement', label: 'Enunciado', render: (v) => <span className="text-zinc-200 line-clamp-2 max-w-xs">{v}</span> },
    { key: 'type', label: 'Tipo', render: typeBadge },
  ]

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>← Volver</Button>
          <div className="w-px h-5 bg-zinc-700" />
          <div>
            <div className="text-white font-semibold text-sm">{module.name}</div>
            <div className="text-zinc-500 text-[10px] font-mono">{questions.length} preguntas</div>
          </div>
        </div>
        <Button onClick={openCreate}>+ Nueva pregunta</Button>
      </div>

      <Table
        columns={columns}
        data={questions}
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
          <div>
            <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-1.5">Tipo</label>
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, correctAnswer: '' }))}
            >
              <option value="truefalse">Verdadero / Falso</option>
              <option value="multiple">Opción múltiple</option>
            </select>
          </div>
          <div>
            <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-1.5">Enunciado</label>
            <textarea
              rows={3}
              className={`${inputCls} resize-none`}
              value={form.statement}
              onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="Escribí la pregunta aquí..."
            />
          </div>
          {form.type === 'multiple' && (
            <div className="space-y-2">
              <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-widest">Opciones</label>
              {['a', 'b', 'c', 'd'].map((letter, i) => (
                <div key={letter} className="flex items-center gap-2">
                  <span className="text-zinc-600 text-xs font-mono w-4">{letter})</span>
                  <input
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-red-600"
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
            <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-1.5">Respuesta correcta</label>
            {form.type === 'truefalse' ? (
              <select
                className={inputCls}
                value={form.correctAnswer}
                onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))}
              >
                <option value="">Seleccioná...</option>
                <option value="Verdadero">Verdadero</option>
                <option value="Falso">Falso</option>
              </select>
            ) : (
              <select
                className={inputCls}
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

export default function Questions() {
  const [selectedModuleId, setSelectedModuleId] = useState(null)

  if (selectedModuleId === null) {
    return <ModuleSelector onSelect={setSelectedModuleId} />
  }

  return <QuestionsTable moduleId={selectedModuleId} onBack={() => setSelectedModuleId(null)} />
}
