import { useState, useMemo } from 'react'
import Table from '../../components/Table'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import { trainingModules as initialModules } from '../data/training-modules'

const EMPTY_QUESTION_FORM = { type: 'truefalse', statement: '', options: ['', '', '', ''], correctAnswer: '', image: '' }

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

export default function TrainingModules() {
  const [modules, setModules] = useState(initialModules)
  const [view, setView] = useState({ type: 'modules' })

  // Module modal
  const [moduleModal, setModuleModal] = useState(null)
  const [moduleForm, setModuleForm] = useState({ name: '', active: true })

  // Question modal
  const [questionModal, setQuestionModal] = useState(null)
  const [questionForm, setQuestionForm] = useState(EMPTY_QUESTION_FORM)

  // --- Module CRUD ---
  const openCreateModule = () => {
    setModuleForm({ name: '', active: true })
    setModuleModal({ mode: 'create' })
  }

  const openEditModule = (mod) => {
    setModuleForm({ name: mod.name, active: mod.active })
    setModuleModal({ mode: 'edit', data: mod })
  }

  const handleSaveModule = () => {
    if (!moduleForm.name.trim()) return
    if (moduleModal.mode === 'create') {
      setModules((prev) => [...prev, { id: Date.now(), questions: [], ...moduleForm }])
    } else {
      setModules((prev) => prev.map((m) => m.id === moduleModal.data.id ? { ...m, ...moduleForm } : m))
    }
    setModuleModal(null)
  }

  const toggleActive = (id) => {
    setModules((prev) => prev.map((m) => m.id === id ? { ...m, active: !m.active } : m))
  }

  // --- Question CRUD ---
  const openCreateQuestion = () => {
    setQuestionForm(EMPTY_QUESTION_FORM)
    setQuestionModal({ mode: 'create' })
  }

  const openEditQuestion = (q) => {
    setQuestionForm({
      type: q.type,
      statement: q.statement,
      options: q.options ? [...q.options] : ['', '', '', ''],
      correctAnswer: q.correctAnswer,
      image: q.image ?? '',
    })
    setQuestionModal({ mode: 'edit', data: q })
  }

  const handleSaveQuestion = () => {
    if (!questionForm.statement.trim() || !questionForm.correctAnswer) return
    const base = {
      type: questionForm.type,
      statement: questionForm.statement,
      correctAnswer: questionForm.correctAnswer,
      options: (questionForm.type === 'multiple' || questionForm.type === 'image-options')
        ? questionForm.options.filter(Boolean)
        : undefined,
      image: questionForm.image.trim() || undefined,
    }
    setModules((prev) => prev.map((m) => {
      if (m.id !== view.moduleId) return m
      const newQuestions = questionModal.mode === 'create'
        ? [...m.questions, { id: Date.now(), ...base }]
        : m.questions.map((q) => q.id === questionModal.data.id ? { ...q, ...base } : q)
      return { ...m, questions: newQuestions }
    }))
    setQuestionModal(null)
  }

  // --- Ranking ---
  const allRanked = useMemo(() => {
    return modules
      .flatMap((m) => m.questions.map((q) => ({ ...q, moduleName: m.name, errorRate: 100 - (q.approvalRate ?? 100) })))
      .sort((a, b) => b.errorRate - a.errorRate)
  }, [modules])

  // --- Vista: Ranking ---
  if (view.type === 'ranking') {
    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView({ type: 'modules' })}>← Volver</Button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <div className="text-slate-900 font-semibold text-sm">Ranking de preguntas más falladas</div>
            <div className="text-slate-400 text-[10px] font-mono">{allRanked.length} preguntas · ordenadas por % de error</div>
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
              {allRanked.map((q, i) => (
                <tr key={q.id} className="border-b border-slate-200/70 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs"><span className="line-clamp-2">{q.statement}</span></td>
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

  // --- Vista: Preguntas de un módulo ---
  if (view.type === 'questions') {
    const module = modules.find((m) => m.id === view.moduleId)

    const questionColumns = [
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
            <Button variant="ghost" size="sm" onClick={() => setView({ type: 'modules' })}>← Volver</Button>
            <div className="w-px h-5 bg-slate-200" />
            <div>
              <div className="text-slate-900 font-semibold text-sm">{module.name}</div>
              <div className="text-slate-400 text-[10px] font-mono">{module.questions.length} preguntas</div>
            </div>
          </div>
          <Button onClick={openCreateQuestion}>+ Nueva pregunta</Button>
        </div>

        <Table
          columns={questionColumns}
          data={module.questions}
          actions={(row) => (
            <Button variant="ghost" size="sm" onClick={() => openEditQuestion(row)}>Editar</Button>
          )}
        />

        <Modal
          open={!!questionModal}
          onClose={() => setQuestionModal(null)}
          title={questionModal?.mode === 'create' ? 'Nueva pregunta' : 'Editar pregunta'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setQuestionModal(null)}>Cancelar</Button>
              <Button onClick={handleSaveQuestion}>Guardar</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Tipo</label>
              <select
                className={inputCls}
                value={questionForm.type}
                onChange={(e) => setQuestionForm((f) => ({ ...f, type: e.target.value, correctAnswer: '' }))}
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
                value={questionForm.statement}
                onChange={(e) => setQuestionForm((f) => ({ ...f, statement: e.target.value }))}
                placeholder="Escribí la pregunta aquí..."
              />
            </div>
            <div>
              <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">
                Imagen <span className="normal-case font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                className={inputCls}
                value={questionForm.image}
                onChange={(e) => setQuestionForm((f) => ({ ...f, image: e.target.value }))}
                placeholder="/images/cartel-riesgo-electrico.png"
              />
              {questionForm.image.trim() && (
                <div className="mt-2 rounded overflow-hidden border border-slate-200 bg-slate-50">
                  <img src={questionForm.image} alt="Preview" className="max-h-40 w-full object-contain" />
                </div>
              )}
            </div>
            {questionForm.type === 'multiple' && (
              <div className="space-y-2">
                <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest">Opciones</label>
                {['a', 'b', 'c', 'd'].map((letter, i) => (
                  <div key={letter} className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-mono w-4">{letter})</span>
                    <input
                      className="flex-1 bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                      value={questionForm.options[i]}
                      onChange={(e) => {
                        const opts = [...questionForm.options]
                        opts[i] = e.target.value
                        setQuestionForm((f) => ({ ...f, options: opts }))
                      }}
                      placeholder={`Opción ${letter}`}
                    />
                  </div>
                ))}
              </div>
            )}
            {questionForm.type === 'image-options' && (
              <div className="space-y-3">
                <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest">Opciones (rutas de imagen)</label>
                {['a', 'b', 'c', 'd'].map((letter, i) => (
                  <div key={letter} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs font-mono w-4">{letter})</span>
                      <input
                        className="flex-1 bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-900 text-sm focus:outline-none focus:border-red-600"
                        value={questionForm.options[i]}
                        onChange={(e) => {
                          const opts = [...questionForm.options]
                          opts[i] = e.target.value
                          setQuestionForm((f) => ({ ...f, options: opts }))
                        }}
                        placeholder="/images/contenedor-verde.png"
                      />
                    </div>
                    {questionForm.options[i].trim() && (
                      <div className="ml-6 h-16 w-16 rounded overflow-hidden border border-slate-200 bg-slate-50">
                        <img src={questionForm.options[i]} alt="preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="block text-slate-600 text-xs font-semibold uppercase tracking-widest mb-1.5">Respuesta correcta</label>
              {questionForm.type === 'truefalse' ? (
                <select
                  className={inputCls}
                  value={questionForm.correctAnswer}
                  onChange={(e) => setQuestionForm((f) => ({ ...f, correctAnswer: e.target.value }))}
                >
                  <option value="">Seleccioná...</option>
                  <option value="Verdadero">Verdadero</option>
                  <option value="Falso">Falso</option>
                </select>
              ) : questionForm.type === 'image-options' ? (
                <div className="grid grid-cols-4 gap-2">
                  {questionForm.options.filter(Boolean).map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setQuestionForm((f) => ({ ...f, correctAnswer: opt }))}
                      className={`rounded overflow-hidden border-2 aspect-square transition-all ${
                        questionForm.correctAnswer === opt ? 'border-red-600 ring-2 ring-red-600/30' : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <img src={opt} alt={`Opción ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  className={inputCls}
                  value={questionForm.correctAnswer}
                  onChange={(e) => setQuestionForm((f) => ({ ...f, correctAnswer: e.target.value }))}
                >
                  <option value="">Seleccioná la opción correcta...</option>
                  {questionForm.options.filter(Boolean).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              )}
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  // --- Vista: Tabla de módulos ---
  const moduleColumns = [
    { key: 'name', label: 'Nombre' },
    {
      key: 'active',
      label: 'Estado',
      render: (val) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${val ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
          {val ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'questions',
      label: 'Preguntas',
      render: (questions) => <span className="text-slate-700">{questions.length}</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 font-bold text-xl">Capacitaciones</h2>
          <p className="text-slate-400 text-sm">{modules.length} módulos · {modules.filter((m) => m.active).length} activos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setView({ type: 'ranking' })}>Ver ranking de errores</Button>
          <Button onClick={openCreateModule}>+ Nuevo módulo</Button>
        </div>
      </div>

      <Table
        columns={moduleColumns}
        data={modules}
        actions={(row) => (
          <>
            <Button variant="ghost" size="sm" onClick={() => setView({ type: 'questions', moduleId: row.id })}>
              Ver preguntas
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openEditModule(row)}>Editar</Button>
            <Button variant={row.active ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActive(row.id)}>
              {row.active ? 'Desactivar' : 'Activar'}
            </Button>
          </>
        )}
      />

      <Modal
        open={!!moduleModal}
        onClose={() => setModuleModal(null)}
        title={moduleModal?.mode === 'create' ? 'Nuevo módulo' : 'Editar módulo'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModuleModal(null)}>Cancelar</Button>
            <Button onClick={handleSaveModule}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1">Nombre</label>
            <input
              className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-slate-900 text-sm focus:outline-none focus:border-red-600"
              value={moduleForm.name}
              onChange={(e) => setModuleForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre del módulo"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-slate-700 text-sm font-medium">Estado</label>
            <button
              onClick={() => setModuleForm((f) => ({ ...f, active: !f.active }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${moduleForm.active ? 'bg-red-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${moduleForm.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-slate-400 text-sm">{moduleForm.active ? 'Activo' : 'Inactivo'}</span>
          </div>
        </div>
      </Modal>
    </div>
  )
}
