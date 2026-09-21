import { createContext, useContext } from 'react'

// El contexto y su hook viven acá, separados del provider (.jsx), por la regla
// react-refresh/only-export-components: un archivo que exporta un componente
// no puede exportar además helpers. Mismo motivo que parametrosExamen.js.

export const SesionContext = createContext({
  identidad: null,
  cargando: true,
  error: null,
  recargar: () => {},
})

/**
 * La identidad del usuario logueado: `{ identidad, cargando, error, recargar }`,
 * donde `identidad` es lo que devuelve GET /auth/me (id, nombre, apellido,
 * email, rol, organizacionId). `cargando`/`error` son mutuamente excluyentes
 * de `identidad` en null por dos motivos distintos — un consumidor que
 * necesite tratarlos distinto (ej. no ofrecer una acción sensible mientras no
 * se sabe todavía) no puede asumir "sin identidad = sin permiso" sin mirar
 * los dos. `recargar()` reintenta el pedido a /auth/me.
 */
export function useSesion() {
  return useContext(SesionContext)
}

/** Atajo para el caso más común: ¿el que está mirando es administrador? */
export function useEsAdministrador() {
  const { identidad } = useSesion()
  return identidad?.rol === 'ADMINISTRADOR'
}
