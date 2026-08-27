import Button from './Button'

// Fallback de Sentry.ErrorBoundary: Sentry lo llama como función, con
// { error, resetError }, no como JSX — por eso NO recibe children ni se usa
// con <ErrorFallback />. Mismo patrón visual que el banner de error de
// Overview.jsx (tríada red-50/red-200/red-700 de la paleta del proyecto).
export default function ErrorFallback({ resetError }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between gap-3 flex-wrap max-w-6xl m-6">
      <span>Ocurrió un error inesperado en esta pantalla.</span>
      <Button variant="secondary" size="sm" onClick={resetError}>
        Reintentar
      </Button>
    </div>
  )
}
