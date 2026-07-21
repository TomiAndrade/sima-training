import useNavigation from './hooks/useNavigation'
import BackofficeLayout from './pages/BackofficeLayout'
import Dashboard from './pages/Dashboard'
import Clients from './core/pages/Clients'
import Usuarios from './core/pages/Usuarios'
import Puestos from './core/pages/Puestos'
import CentrosCosto from './core/pages/CentrosCosto'
import Overview from './sima-check/pages/Overview'
import TrainingModules from './sima-check/pages/TrainingModules'
import TrainingAssignments from './sima-check/pages/TrainingAssignments'
import Questions from './sima-check/pages/Questions'

const PAGES = {
  dashboard: Dashboard,
  clients: Clients,
  usuarios: Usuarios,
  puestos: Puestos,
  'centros-costo': CentrosCosto,
  'sima-check-overview': Overview,
  'training-modules': TrainingModules,
  questions: Questions,
  'training-assignments': TrainingAssignments,
}

export default function App() {
  const { page, navigate } = useNavigation('dashboard')
  const PageComponent = PAGES[page] ?? Dashboard

  return (
    <BackofficeLayout page={page} navigate={navigate}>
      <PageComponent navigate={navigate} />
    </BackofficeLayout>
  )
}
