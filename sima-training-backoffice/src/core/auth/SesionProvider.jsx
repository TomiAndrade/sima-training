import { useCallback, useEffect, useState } from 'react'
import { authApi } from '../api/auth'
import { SesionContext } from './sesionContext'

/**
 * Pide GET /auth/me al montar (App.jsx sólo lo renderiza con la sesión de
 * Auth0 ya resuelta, y con el token getter ya registrado — ver el
 * useLayoutEffect de App.jsx) y deja la identidad disponible para toda la
 * app. Es un pedido por sesión, no por pantalla: el rol no cambia mientras
 * alguien está logueado, y hacerlo en cada pantalla que lo necesite sería el
 * mismo request repetido.
 *
 * Un fallo acá NO bloquea la app: `identidad` queda en null y la UI cae al
 * comportamiento más restrictivo (sin permisos de administrador). Fallar
 * cerrado del lado del cliente es lo coherente con el guard del backend —
 * que es quien decide de verdad; esto sólo decide qué se muestra. Pero un
 * fallo de red no es lo mismo que "este usuario no es admin": `error` viaja
 * aparte de `identidad` para que un consumidor pueda distinguir "todavía no
 * sabemos" de "sabemos que no tiene permiso", y `recargar()` deja reintentar
 * el pedido sin recargar toda la página.
 */
export default function SesionProvider({ children }) {
  const [estado, setEstado] = useState({
    identidad: null,
    cargando: true,
    error: null,
  })
  // Se incrementa para forzar un pedido nuevo (botón "Reintentar" de la UI).
  // No hay reintento automático: un fallo de /auth/me es raro y persistente
  // (token inválido, backend caído), y reintentar solo agregaría requests sin
  // más chance de éxito que la que ya le da el retry de un solo intento que
  // ya tiene client.js ante un 401.
  const [intento, setIntento] = useState(0)

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
  }, [intento])

  // El reset de `estado` va acá y no en el efecto de arriba: setState
  // síncrono dentro de un efecto dispara un render en cascada (lo marca
  // react-hooks/set-state-in-effect). Acá es la respuesta a un click, no un
  // efecto — dispara el render una sola vez y de paso deja `cargando: true`
  // en pantalla antes de que el nuevo pedido a /auth/me siquiera salga.
  const recargar = useCallback(() => {
    setEstado({ identidad: null, cargando: true, error: null })
    setIntento((n) => n + 1)
  }, [])

  return (
    <SesionContext.Provider value={{ ...estado, recargar }}>{children}</SesionContext.Provider>
  )
}
