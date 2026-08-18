import { useEffect, useState } from 'react'

// La página actual vive en el **hash de la URL** (`#usuarios`), no en un
// `useState` suelto: sin eso, un F5 devolvía al Panel Principal y se perdía
// dónde estabas.
//
// Se eligió el hash sobre `sessionStorage` por dos cosas que el usuario ve:
// la dirección se puede **compartir** (mandar "mirá esta pantalla" y que abra
// ahí) y el **botón "atrás" del navegador funciona**, que hoy no hacía nada.
// `sessionStorage` era menos código pero no da ninguna de las dos, y además
// muere al abrir una pestaña nueva.
//
// **Esto NO es react-router** y no contradice la decisión de no usarlo: no hay
// rutas anidadas, ni params, ni `<Link>`, ni matching. Es una variable que en
// vez de vivir en memoria vive en la barra de direcciones.
//
// **El hash es la única fuente de verdad**: `navigate()` lo escribe y el estado
// se actualiza recién cuando el navegador dispara `hashchange`. Un solo camino
// de datos — si el estado se seteara aparte, el botón "atrás" (que sólo cambia
// la URL) lo dejaría desincronizado.
const leerHash = () => {
  try {
    return decodeURIComponent(window.location.hash.replace(/^#/, ''));
  } catch {
    // Un hash con un `%` suelto rompe decodeURIComponent. No es un caso real
    // navegando, sí lo es si alguien edita la URL a mano.
    return '';
  }
};

export default function useNavigation(inicial, paginasValidas) {
  // Una página inventada (`#no-existe`, un link viejo a una pantalla que ya no
  // está) cae a la inicial. Sin esto, `App` mostraría el Dashboard igual por su
  // `?? Dashboard`, pero la URL seguiría diciendo `#no-existe`: la barra de
  // direcciones mentiría sobre lo que hay en pantalla.
  const normalizar = (p) => (paginasValidas.includes(p) ? p : inicial);

  const [page, setPage] = useState(() => normalizar(leerHash()));

  useEffect(() => {
    // Normalizar la URL al montar (se entró a `/` pelado, o con un hash
    // inventado) con `replaceState` y NO escribiendo el hash: escribirlo
    // agregaría una entrada al historial, y el primer "atrás" del usuario no
    // haría nada visible — volvería a la misma pantalla sin hash.
    if (leerHash() !== page) {
      window.history.replaceState(null, '', `#${page}`);
    }
    // Sólo al montar: después el hash lo maneja navigate().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHashChange = () => setPage(normalizar(leerHash()));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escribe el hash y listo: el `hashchange` que eso dispara actualiza el
  // estado. Navegar a la página en la que ya estás no dispara nada (el hash no
  // cambia), que es el comportamiento correcto — no ensucia el historial con
  // entradas repetidas.
  const navigate = (p) => {
    window.location.hash = normalizar(p);
  };

  return { page, navigate };
}
