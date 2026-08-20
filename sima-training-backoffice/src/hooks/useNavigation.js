import { useEffect, useState } from 'react'

// La navegación del backoffice vive en el **hash de la URL**
// (`#usuarios`, `#usuarios/historial/42`), no en un `useState` suelto: sin eso,
// un F5 devolvía al Panel Principal y se perdía dónde estabas.
//
// Se eligió el hash sobre `sessionStorage` por dos cosas que el usuario ve:
// la dirección se puede **compartir** (mandar "mirá esta pantalla" y que abra
// ahí) y el **botón "atrás" del navegador funciona**, que antes no hacía nada.
// `sessionStorage` era menos código y no da ninguna de las dos; encima muere al
// abrir una pestaña nueva.
//
// **Esto NO es react-router** y no contradice la decisión de no usarlo: no hay
// rutas anidadas, ni params, ni `<Link>`, ni matching de patrones, ni una
// dependencia nueva. Es el hash partido por `/`: el primer segmento es la
// página y el resto lo interpreta la pantalla que corresponda.
//
// **El hash es la única fuente de verdad**: `navigate()` y `setSub()` lo
// escriben, y el estado se actualiza recién cuando el navegador dispara
// `hashchange`. Un solo camino de datos — si el estado se seteara aparte, el
// botón "atrás" (que sólo cambia la URL) lo dejaría desincronizado.

// Segmentos del hash, ya decodificados. Se decodifica **por segmento** y no el
// hash entero: decodificar antes de partir haría que un `%2F` dentro de un id
// se convirtiera en un separador de más.
const segmentosDelHash = () =>
  window.location.hash
    .replace(/^#/, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        // Un `%` suelto rompe decodeURIComponent. No pasa navegando, sí si
        // alguien edita la URL a mano.
        return seg;
      }
    });

const construirHash = (page, sub) =>
  [page, ...sub].map(encodeURIComponent).join('/');

export default function useNavigation(inicial, paginasValidas) {
  // Una página inventada (`#no-existe`, un link viejo a una pantalla
  // renombrada) cae a la inicial. Sin esto, `App` mostraría el Dashboard igual
  // por su `?? Dashboard`, pero la URL seguiría diciendo `#no-existe`: la barra
  // de direcciones mintiendo sobre lo que hay en pantalla.
  const normalizar = (p) => (paginasValidas.includes(p) ? p : inicial);

  const parsear = () => {
    const segs = segmentosDelHash();
    const page = normalizar(segs[0]);
    // Si la página no era válida, el resto del hash tampoco significa nada:
    // `#no-existe/historial/42` no puede caer en el Dashboard arrastrando un
    // sub que ese Dashboard no sabe leer.
    return { page, sub: segs[0] === page ? segs.slice(1) : [] };
  };

  const [ruta, setRuta] = useState(parsear);

  useEffect(() => {
    // Normalizar la URL al montar (se entró a `/` pelado, o con un hash
    // inventado) con `replaceState` y NO escribiendo el hash: escribirlo
    // agregaría una entrada al historial, y el primer "atrás" del usuario no
    // haría nada visible — volvería a la misma pantalla, sólo que sin hash.
    const canonico = construirHash(ruta.page, ruta.sub);
    if (window.location.hash.replace(/^#/, '') !== canonico) {
      window.history.replaceState(null, '', `#${canonico}`);
    }
    // Sólo al montar: después el hash lo manejan navigate() y setSub().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHashChange = () => setRuta(parsear());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // `parsear` cierra sobre `inicial`/`paginasValidas`, que son constantes de
    // módulo en App.jsx — no cambian entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escriben el hash y listo: el `hashchange` que eso dispara actualiza el
  // estado. Navegar a donde ya estás no dispara nada (el hash no cambia), que
  // es lo correcto — no ensucia el historial con entradas repetidas.
  const escribir = (page, sub) => {
    window.location.hash = construirHash(page, sub);
  };

  // Ir a una página **limpia el sub** por default: tocar "Usuarios" en el
  // sidebar lleva al listado, no a la sub-vista que hubiera quedado abierta.
  // El segundo parámetro es para el caso contrario —saltar a otra pantalla
  // llevándole un dato—, como el "Ver preguntas" de Bases, que abre Preguntas
  // ya filtrada por esa base y nivel. Sin esto habría que hacer navigate() y
  // después setSub(), que son dos escrituras del hash y dos entradas en el
  // historial para un solo salto.
  const navigate = (p, sub = []) => escribir(normalizar(p), sub);

  // Abre/cierra una sub-vista **dentro** de la página actual, agregando una
  // entrada al historial: por eso "atrás" sale del historial de una persona y
  // vuelve al listado, en vez de saltar a la pantalla anterior.
  const setSub = (sub) => escribir(ruta.page, sub);

  // Igual que setSub pero SIN agregar una entrada al historial. Es para los sub
  // que son una **intención de entrada** y no un lugar: el `base/<id>/nivel/<id>`
  // con el que Bases abre Preguntas se aplica al montar y se consume — desde ahí
  // la pantalla se comporta igual que si hubieras entrado por el sidebar, y el
  // filtro que quede en pantalla es el que dice el select, no el que quedó
  // congelado en la URL.
  //
  // Es la ÚNICA función que escribe el estado a mano en vez de dejar que lo
  // haga el hashchange, y por eso vale la excepción a "el hash es la única
  // fuente de verdad": replaceState no dispara hashchange, así que sin el
  // setRuta el estado quedaría con el sub viejo. No desincroniza el botón
  // "atrás" —que es lo que esa regla protege— justamente porque reemplaza en
  // vez de apilar: la entrada del historial sigue siendo la de la pantalla
  // anterior.
  const replaceSub = (sub) => {
    const canonico = construirHash(ruta.page, sub);
    if (window.location.hash.replace(/^#/, '') === canonico) return;
    window.history.replaceState(null, '', `#${canonico}`);
    setRuta({ page: ruta.page, sub });
  };

  return { page: ruta.page, sub: ruta.sub, navigate, setSub, replaceSub };
}
