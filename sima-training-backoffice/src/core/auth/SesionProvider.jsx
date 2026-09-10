import { useEffect, useState } from 'react'
import { authApi } from '../api/auth'
import { SesionContext } from './sesionContext'

/**
 * Pide GET /auth/me UNA vez, al montar (App.jsx sólo lo renderiza con la
 * sesión de Auth0 ya resuelta), y deja la identidad disponible para toda la
 * app. Es un pedido por sesión, no por pantalla: el rol no cambia mientras
 * alguien está logueado, y hacerlo en cada pantalla que lo necesite sería el
 * mismo request repetido.
 *
 * Un fallo acá NO bloquea la app: `identidad` queda en null y la UI cae al
 * comportamiento más restrictivo (sin permisos de administrador). Fallar
 * cerrado del lado del cliente es lo coherente con el guard del backend —
 * que es quien decide de verdad; esto sólo decide qué se muestra.
 */
export default function SesionProvider({ children }) {
  const [estado, setEstado] = useState({
    identidad: null,
    cargando: true,
    error: null,
  })

  useEffect(() => {
    let activo = true
    authApi
      .me()
      .then((identidad) => {
        if (activo) setEstado({ identidad, cargando: false, error: null })
      })
      .catch((err) => {
        if (activo) setEstado({ identidad: null, cargando: false, error: err.message })
      })
    return () => {
      activo = false
    }
  }, [])

  return <SesionContext.Provider value={estado}>{children}</SesionContext.Provider>
}
