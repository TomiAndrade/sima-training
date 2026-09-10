import { createContext, useContext } from 'react'

// El contexto y su hook viven acá, separados del provider (.jsx), por la regla
// react-refresh/only-export-components: un archivo que exporta un componente
// no puede exportar además helpers. Mismo motivo que parametrosExamen.js.

export const SesionContext = createContext({
  identidad: null,
  cargando: true,
  error: null,
})

/**
 * La identidad del usuario logueado: `{ identidad, cargando, error }`, donde
 * `identidad` es lo que devuelve GET /auth/me (id, nombre, apellido, email,
 * rol, organizacionId).
 */
export function useSesion() {
  return useContext(SesionContext)
}

/** Atajo para el caso más común: ¿el que está mirando es administrador? */
export function useEsAdministrador() {
  const { identidad } = useSesion()
  return identidad?.rol === 'ADMINISTRADOR'
}
