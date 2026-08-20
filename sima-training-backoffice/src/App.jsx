import useNavigation from './hooks/useNavigation'
import BackofficeLayout from './pages/BackofficeLayout'
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
      <PageComponent navigate={navigate} sub={sub} setSub={setSub} replaceSub={replaceSub} />
    </BackofficeLayout>
  )
}
