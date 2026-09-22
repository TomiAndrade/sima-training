import { useEffect, useLayoutEffect } from 'react'
import * as Sentry from '@sentry/react'
import { useAuth0 } from '@auth0/auth0-react'
import useNavigation from './hooks/useNavigation'
import SesionProvider from './core/auth/SesionProvider'
import { setAuth0TokenGetter, setAuthErrorHandler } from './core/api/client'
import BackofficeLayout from './pages/BackofficeLayout'
import ErrorFallback from './components/ErrorFallback'
import Dashboard from './pages/Dashboard'
import Usuarios from './core/pages/Usuarios'
import Organizaciones from './core/pages/Organizaciones'
import Puestos from './core/pages/Puestos'
import CentrosCosto from './core/pages/CentrosCosto'
import AuditoriaGlobal from './core/pages/AuditoriaGlobal'
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
  organizaciones: Organizaciones,
  puestos: Puestos,
  'centros-costo': CentrosCosto,
  auditoria: AuditoriaGlobal,
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
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0()
  const { page, sub, navigate, setSub, replaceSub } = useNavigation('dashboard', PAGE_IDS)
  const PageComponent = PAGES[page] ?? Dashboard

  // Gate de auth: sin router, así que no hay una "ruta protegida" que
  // envolver — es la app entera. loginWithRedirect() manda al Universal
  // Login de Auth0; onRedirectCallback (main.jsx) trae de vuelta al hash que
  // había antes de irse.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) loginWithRedirect()
  }, [isLoading, isAuthenticated, loginWithRedirect])

  // Se registra recién cuando hay sesión: mientras tanto client.js rechaza
  // cualquier request autenticado (no debería pasar, el return de abajo lo
  // evita, pero es la guarda barata).
  //
  // useLayoutEffect y no useEffect: en el mismo commit donde `isAuthenticated`
  // pasa a true, App dibuja SesionProvider por primera vez, y SesionProvider
  // dispara su propio efecto (GET /auth/me) apenas monta. Los efectos pasivos
  // (useEffect) de un commit corren hijo-antes-que-padre, así que un
  // useEffect acá perdía la carrera: el fetch de /auth/me salía antes de que
  // este efecto registrara el token getter, y client.js lo rechazaba con
  // "Auth0 todavía no está listo" (identidad quedaba en null). Los efectos de
  // layout, en cambio, corren TODOS —de toda la rama que se está montando—
  // antes que CUALQUIER efecto pasivo del mismo commit, así que este registro
  // queda listo antes de que SesionProvider pida /auth/me.
  useLayoutEffect(() => {
    if (isAuthenticated) setAuth0TokenGetter(() => getAccessTokenSilently())
  }, [isAuthenticated, getAccessTokenSilently])

  // Mismo motivo que el de arriba: tiene que estar registrado antes de que
  // cualquier request autenticado (el de /auth/me incluido) pueda fallar y
  // necesitar este handler.
  //
  // Cuando la sesión ya no se puede renovar sola (getAccessTokenSilently()
  // tira, o el backend sigue rechazando el token con 401 después de
  // reintentar) client.js llama a esto en vez de dejar la pantalla que
  // disparó el request colgada con una promesa rechazada.
  useLayoutEffect(() => {
    setAuthErrorHandler(() => loginWithRedirect())
  }, [loginWithRedirect])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Conectando con Auth0…
      </div>
    )
  }

  // SesionProvider va acá adentro y no en main.jsx a propósito: pide
  // GET /auth/me, que necesita el token ya registrado en client.js.
  // Envolver la app entera lo haría correr antes de que Auth0 resuelva
  // la sesión, y el request saldría sin Bearer.
  return (
    <SesionProvider>
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
    </SesionProvider>
  )
}
