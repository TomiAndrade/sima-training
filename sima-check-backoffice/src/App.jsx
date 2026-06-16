import useNavigation from './hooks/useNavigation'
import BackofficeLayout from './pages/BackofficeLayout'
import Dashboard from './pages/Dashboard'
import Companies from './core/pages/Companies'
import Users from './core/pages/Users'
import TrainingModules from './sima-check/pages/TrainingModules'
import Questions from './sima-check/pages/Questions'
import TrainingAssignments from './sima-check/pages/TrainingAssignments'

const PAGES = {
  dashboard: Dashboard,
  companies: Companies,
  users: Users,
  'training-modules': TrainingModules,
  questions: Questions,
  'training-assignments': TrainingAssignments,
}

export default function App() {
  const { page, navigate } = useNavigation('dashboard')
  const PageComponent = PAGES[page] ?? Dashboard

  return (
    <BackofficeLayout page={page} navigate={navigate}>
      <PageComponent />
    </BackofficeLayout>
  )
}
