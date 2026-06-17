import { useState } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { trainingModules as modules } from '../data/training-modules'

const EMPTY_FORM = { type: 'truefalse', statement: '', options: ['', '', '', ''], correctAnswer: '', image: '' }

const inputCls = 'w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600'

function typeBadge(type) {
  if (type === 'truefalse') return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-sky-50 text-sky-600 border-sky-200">V / F</span>
  if (type === 'image-options') return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-amber-50 text-amber-600 border-amber-200">Imágenes</span>
  return <span className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono border bg-violet-50 text-violet-600 border-violet-200">Múltiple</span>
}

function ApprovalCell({ rate }) {
  if (rate == null) return <span className="text-slate-300 text-xs">—</span>
  const color =
    rate >= 70 ? { bar: 'bg-emerald-500', text: 'text-emerald-600' }
    : rate >= 50 ? { bar: 'bg-amber-500', text: 'text-amber-600' }
    : { bar: 'bg-red-500', text: 'text-red-600' }
  return (
    <div className="flex flex-col gap-1 min-w-[64px]">
      <span className={`text-base font-bold font-mono leading-none ${color.text}`}>{rate}%</span>
      <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color.bar}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  )
}

function RankingView({ onBack }) {
  const allQuestions = modules.flatMap((m) =>
    m.questions.map((q) => ({ ...q, moduleName: m.name, errorRate: 100 - (q.approvalRate ?? 100) }))
  )
  const ranked = [...allQuestions].sort((a, b) => b.errorRate - a.errorRate)

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Volver</Button>
        <div className="w-px h-5 bg-slate-200" />
        <div>
          <div className="text-slate-900 font-semibold text-sm">Ranking de preguntas más falladas</div>
          <div className="text-slate-400 text-[10px] font-mono">{ranked.length} preguntas · ordenadas por % de error</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="px-4 py-3 text-slate-500 text-[10px] font-semibold uppercase tracking-widest w-12">#</th>
              <th className="px-4 py-3 text-slate-500 text-[10px] font-semibold uppercase tracking-widest">Pregunta</th>
              <th className="px-4 py-3 text-slate-500 text-[10px] font-semibold uppercase tracking-widest">Módulo</th>
              <th className="px-4 py-3 text-slate-500 text-[10px] font-semibold uppercase tracking-widest">Tipo</th>
              <th className="px-4 py-3 text-slate-500 text-[10px] font-semibold uppercase tracking-widest text-right">% Error</th>
              <th className="px-4 py-3 text-slate-500 text-[10px] font-semibold uppercase tracking-widest">Aprobación</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((q, i) => (
              <tr key={q.id} className="border-b border-slate-200/70 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                <td className="px-4 py-3 text-slate-700 max-w-xs">
                  <span className="line-clamp-2">{q.statement}</span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{q.moduleName}</td>
                <td className="px-4 py-3">{typeBadge(q.type)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-mono font-bold text-sm ${q.errorRate >= 50 ? 'text-red-600' : q.errorRate >= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {q.errorRate}%
                  </span>
                </td>
                <td className="px-4 py-3"><ApprovalCell rate={q.approvalRate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ModuleSelector({ onRanking, onSelect }) {
  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest mb-1">Preguntas</div>
          <p className="text-slate-500 text-sm">Seleccioná un módulo para ver y editar sus preguntas.</p>
        </div>
        <Button variant="secondary" onClick={onRanking}>Ver ranking de errores</Button>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {modules.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="text-left bg-white border border-slate-200 rounded p-5 relative overflow-hidden hover:bg-slate-50 hover:border-slate-300 transition-colors duration-150 group shadow-sm"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-red-600/50" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-slate-900 font-semibold text-sm mb-1">{m.name}</div>
                <div className="text-slate-400 text-xs font-mono">{m.questions.length} preguntas</div>
              </div>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold font-mono border uppercase tracking-wider ${m.active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {m.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="mt-4 text-slate-400 text-[10px] font-mono uppercase tracking-widest group-hover:text-slate-500 transition-colors">
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
      image: q.image ?? '',
    })
    setModal({ mode: 'edit', data: q })
  }

  const handleSave = () => {
    if (!form.statement.trim() || !form.correctAnswer) return
    const base = {
      type: form.type,
      statement: form.statement,
      correctAnswer: form.correctAnswer,
      options: (form.type === 'multiple' || form.type === 'image-options') ? form.options.filter(Boolean) : undefined,
      image: form.image.trim() || undefined,
    }
    if (modal.mode === 'create') {
      setQuestions((prev) => [...prev, { id: Date.now(), ...base }])
    } else {
      setQuestions((prev) => prev.map((q) => q.id === modal.data.id ? { ...q, ...base } : q))
    }
    setModal(null)
  }

  const columns = [
    { key: 'statement', label: 'Enunciado', render: (v, row) => (
      <div className="flex items-start gap-1.5 max-w-xs">
        {row.image && <span className="flex-shrink-0 text-slate-400 text-[11px] mt-0.5">🖼</span>}
        <span className="text-slate-700 line-clamp-2">{v}</span>
      </div>
    )},
    { key: 'type', label: 'Tipo', render: typeBadge },
    { key: 'approvalRate', label: 'Aprobación', render: (rate) => <ApprovalCell rate={rate} /> },
  ]

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>← Volver</Button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <div className="text-slate-900 font-semibold text-sm">{module.name}</div>
            <div className="text-slate-400 text-[10px] font-mono">{questions.length} preguntas</div>
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
            <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Tipo</label>
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, correctAnswer: '' }))}
            >
              <option value="truefalse">Verdadero / Falso</option>
              <option value="multiple">Opción múltiple</option>
              <option value="image-options">Opciones con imagen</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Enunciado</label>
            <textarea
              rows={3}
              className={`${inputCls} resize-none`}
              value={form.statement}
              onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="Escribí la pregunta aquí..."
            />
          </div>
          <div>
            <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">
              Imagen <span className="normal-case font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              className={inputCls}
              value={form.image}
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
              placeholder="/images/cartel-riesgo-electrico.png"
            />
            {form.image.trim() && (
              <div className="mt-2 rounded overflow-hidden border border-slate-200 bg-slate-50">
                <img src={form.image} alt="Preview" className="max-h-40 w-full object-contain" />
              </div>
            )}
          </div>
          {form.type === 'multiple' && (
            <div className="space-y-2">
              <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest">Opciones</label>
              {['a', 'b', 'c', 'd'].map((letter, i) => (
                <div key={letter} className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs font-mono w-4">{letter})</span>
                  <input
                    className="flex-1 bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-red-600"
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
          {form.type === 'image-options' && (
            <div className="space-y-3">
              <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest">Opciones (rutas de imagen)</label>
              {['a', 'b', 'c', 'd'].map((letter, i) => (
                <div key={letter} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-mono w-4">{letter})</span>
                    <input
                      className="flex-1 bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                      value={form.options[i]}
                      onChange={(e) => {
                        const opts = [...form.options]
                        opts[i] = e.target.value
                        setForm((f) => ({ ...f, options: opts }))
                      }}
                      placeholder="/images/contenedor-verde.png"
                    />
                  </div>
                  {form.options[i].trim() && (
                    <div className="ml-6 h-16 w-16 rounded overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={form.options[i]} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Respuesta correcta</label>
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
            ) : form.type === 'image-options' ? (
              <div className="grid grid-cols-4 gap-2">
                {form.options.filter(Boolean).map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, correctAnswer: opt }))}
                    className={`rounded overflow-hidden border-2 aspect-square transition-all ${
                      form.correctAnswer === opt ? 'border-red-600 ring-2 ring-red-600/30' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img src={opt} alt={`Opción ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
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
  const [view, setView] = useState({ type: 'modules' })

  if (view.type === 'ranking') {
    return <RankingView onBack={() => setView({ type: 'modules' })} />
  }

  if (view.type === 'questions') {
    return <QuestionsTable moduleId={view.moduleId} onBack={() => setView({ type: 'modules' })} />
  }

  return (
    <ModuleSelector
      onRanking={() => setView({ type: 'ranking' })}
      onSelect={(id) => setView({ type: 'questions', moduleId: id })}
    />
  )
}
