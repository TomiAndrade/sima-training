import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// Apertura, cierre y ubicación del panel de los dos desplegables del kit
// (`SearchableSelect` y `MultiSelectFilter`). El panel vive en un PORTAL a
// `document.body` con `position: fixed`, y este hook es lo que lo sostiene.
//
// **Por qué el portal.** La mitad de los consumidores están dentro de un
// `Modal`, cuyo cuerpo es `overflow-y-auto`. Un panel `absolute` ahí adentro
// hace dos cosas malas: queda recortado por ese contenedor (las opciones de
// abajo se vuelven inalcanzables) y, sobre todo, le agrega scroll al cuerpo del
// modal. Clickear ESA barra de scroll es un `mousedown` sobre el cuerpo del
// modal — o sea "afuera" del desplegable —, así que el panel se cerraba en el
// acto y con él desaparecía la barra que se estaba por arrastrar: scrollear con
// la ruedita andaba y con la barra era imposible. Con `fixed` fuera del árbol
// del modal el panel no le genera desborde a nadie y el caso deja de existir.
//
// **El costo del `fixed`** es que si algo scrollea hay que cerrar el panel, o
// queda flotando en la pantalla mientras el disparador se va. De eso se ocupa
// el listener de scroll en fase de CAPTURA: los eventos de scroll no burbujean,
// y el que importa acá es el del cuerpo del modal, no el de `window`. Ese mismo
// listener ve también el scroll de la lista interna del panel, y ése hay que
// ignorarlo explícitamente — si no, el panel se cierra al scrollear sus propias
// opciones, que es el mismo bug por otra puerta.
// Aire contra el borde de la ventana. No es sólo estético: pegado al borde no
// se ve dónde termina el panel, y con el margen se lee que lo que falta está
// abajo y hay que scrollear, no que la lista se cortó ahí.
const MARGEN = 16
// Piso de lo que se considera un panel usable. Por debajo de esto conviene
// abrir para el otro lado aunque tenga que scrollear más.
const ALTO_MINIMO_UTIL = 200

export default function usePanelFlotante() {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const posicionar = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const abajo = window.innerHeight - r.bottom - MARGEN
    const arriba = r.top - MARGEN

    // **Se abre hacia abajo salvo que abajo no quepa un panel usable y arriba
    // haya más lugar.** El criterio anterior era "¿entra el panel entero?", y
    // con eso el desplegable del último campo de un modal saltaba para arriba
    // siempre, tapando el formulario que la persona estaba completando — aunque
    // abajo hubiera lugar de sobra para mostrar media docena de opciones.
    const haciaArriba = abajo < ALTO_MINIMO_UTIL && arriba > abajo

    // El panel no elige su alto: se lo da el lugar que hay. Lo que sobra lo
    // absorbe la lista scrolleando por dentro, que es lo que uno espera de un
    // desplegable — y no que se mude de lado o que se corte contra el borde.
    setCoords({
      left: r.left,
      width: r.width,
      maxHeight: Math.round(Math.max(haciaArriba ? arriba : abajo, ALTO_MINIMO_UTIL)),
      ...(haciaArriba
        ? { bottom: window.innerHeight - r.top + 4 }
        : { top: r.bottom + 4 }),
    })
  }, [])

  useLayoutEffect(() => {
    if (open) posicionar()
  }, [open, posicionar])

  useEffect(() => {
    if (!open) return

    const adentro = (target) =>
      Boolean(triggerRef.current?.contains(target) || panelRef.current?.contains(target))

    const onClickOutside = (e) => {
      // El panel vive en un portal, así que no está dentro de triggerRef:
      // hay que chequear los dos nodos o se cerraría al tocar sus opciones.
      if (!adentro(e.target)) setOpen(false)
    }
    // El scroll de la lista interna del panel no mueve el disparador, así que
    // no hay nada que recalcular ni motivo para cerrar. Cualquier otro sí.
    const onScroll = (e) => {
      if (!panelRef.current?.contains(e.target)) setOpen(false)
    }
    const onResize = () => setOpen(false)
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }

    document.addEventListener('mousedown', onClickOutside)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, setOpen, coords, triggerRef, panelRef }
}
