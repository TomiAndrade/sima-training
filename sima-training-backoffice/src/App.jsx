import * as Sentry from '@sentry/react'
import useNavigation from './hooks/useNavigation'
import BackofficeLayout from './pages/BackofficeLayout'
import ErrorFallback from './components/ErrorFallback'
import Dashboard from './pages/Dashboard'
import Usuarios from './core/pages/Usuarios'
import Puestos from './core/pages/Puestos'
import CentrosCosto from './core/pages/CentrosCosto'
import Overview from './sima-check/pages/Overview'
import TrainingModules from './sima-check/pages/TrainingModules'
import TrainingAssignments from './sima-check/pages/TrainingAssignments'
import Questions from './sima-check/pages/Questions'
import ReglasAsignacion from './sima-check/pages/ReglasAsignacion'
import BasesConocimiento from './sima-check/pages/BasesConocimiento'
import Estadisticas from './sima-check/pages/Estadisticas'

const PAGES = {
  dashboard: Dashboard,
  usuarios: Usuarios,
  puestos: Puestos,
  'centros-costo': CentrosCosto,
  'sima-check-overview': Overview,
  'training-modules': TrainingModules,
  questions: Questions,
  'bases-conocimiento': BasesConocimiento,
  'assignment-rules': ReglasAsignacion,
  'training-assignments': TrainingAssignments,
  'sima-check-estadisticas': Estadisticas,
}

// Las claves de PAGES son también los ids válidos del hash de la URL: agregar
// una pantalla acá la hace navegable por `#id` sin tocar nada más. Se calcula
// una sola vez a nivel de módulo — `useNavigation` lo recibe por parámetro en
// vez de importarlo, para no acoplar el hook a esta pantalla en particular.
const PAGE_IDS = Object.keys(PAGES)

export default function App() {
  const { page, sub, navigate, setSub, replaceSub } = useNavigation('dashboard', PAGE_IDS)
  const PageComponent = PAGES[page] ?? Dashboard

  return (
    <BackofficeLayout page={page} navigate={navigate}>
      {/* `sub` es el tramo del hash que sigue a la página, y se usa para dos
          cosas distintas: una sub-vista que vale la pena sobrevivir a un F5
          (`#usuarios/historial/42`, con `setSub`) y una intención de entrada que
          la pantalla consume al montar (`#questions/base/<id>/nivel/<id>`, con
          `replaceSub`). El resto de las pantallas los ignora. */}
      {/* Solo la pantalla se envuelve, no todo App: si una explota, el sidebar
          de BackofficeLayout sigue vivo y se puede navegar a otra. `key={page}`
          fuerza el remount del boundary al cambiar de pantalla — Sentry.ErrorBoundary
          no tiene `resetKeys`, así que sin esto el fallback de una pantalla rota
          quedaría pegado al navegar a una que anda bien. */}
      <Sentry.ErrorBoundary key={page} fallback={ErrorFallback}>
        <PageComponent navigate={navigate} sub={sub} setSub={setSub} replaceSub={replaceSub} />
      </Sentry.ErrorBoundary>
    </BackofficeLayout>
  )
}
