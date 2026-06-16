import useNavigation from './hooks/useNavigation'
import BackofficeLayout from './pages/BackofficeLayout'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Users from './pages/Users'
import Modules from './pages/Modules'
import Questions from './pages/Questions'

const PAGES = {
  dashboard: Dashboard,
  companies: Companies,
  users: Users,
  modules: Modules,
  questions: Questions,
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
