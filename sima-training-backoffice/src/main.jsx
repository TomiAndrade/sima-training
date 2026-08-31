import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.jsx'

Sentry.init({
  // Vacío en desarrollo local: el SDK queda desactivado sin romper nada.
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
  // Sin browserTracingIntegration ni tracesSampleRate: cero tracing/performance.
})

// onRedirectCallback pela `?code=&state=` que Auth0 agrega al volver del
// login — reusa el mismo primitivo que ya usa useNavigation.js dos veces
// (replaceState, sin apilar historial) en vez de pelear con el router que
// esta app no tiene. El hash (donde vive la navegación real) queda intacto.
function onRedirectCallback() {
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <App />
    </Auth0Provider>
  </StrictMode>,
)
