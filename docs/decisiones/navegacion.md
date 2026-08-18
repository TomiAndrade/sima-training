# Decisiones — Navegación del backoffice

Cubre cómo se decide qué pantalla se ve en `sima-training-backoffice`: el hook `useNavigation`, el hash de la URL, y qué sobrevive y qué no a un F5.

**No cubre**: la navegación interna de cada pantalla (el `selectedModuleId` de Preguntas, el early return del historial en Usuarios, el editor de contenido de Módulos) más allá de cómo interactúa con lo de acá. Eso vive en el archivo de decisiones de su dominio.

---

## La página actual vive en el hash de la URL, no en memoria

`useNavigation` era un `useState` pelado, así que **un F5 devolvía siempre al Panel Principal**. Con el catálogo real eso duele más de lo que parece: se pierde la pantalla en la que estabas trabajando por recargar sin querer, o porque el dev server recargó solo.

Ahora la página vive en el hash (`#usuarios`, `#questions`). Se eligió sobre `sessionStorage` por **dos cosas que el usuario ve**, no por elegancia:

- **La dirección se puede compartir.** Mandar "mirá esta pantalla" y que le abra ahí. Con `sessionStorage` el link no dice nada.
- **El botón "atrás" del navegador funciona.** Antes no hacía nada (o te sacaba de la app). Es lo que cualquiera espera de algo que se ve en un navegador.

`sessionStorage` era menos código y no da ninguna de las dos. Encima muere al abrir una pestaña nueva, así que ni siquiera cubría bien el caso que motivaba la story.

### Esto NO es react-router, y no contradice la decisión de no usarlo

No hay rutas anidadas, ni params, ni `<Link>`, ni matching de patrones, ni una dependencia nueva. Es **una variable que cambió de lugar**: de la memoria de React a la barra de direcciones. La decisión de no meter react-router sigue en pie y por los mismos motivos.

### El hash es la única fuente de verdad

`navigate()` **escribe el hash y nada más**; el estado se actualiza recién cuando el navegador dispara `hashchange`. Un solo camino de datos, y es lo que hace que el botón "atrás" funcione: el navegador sólo cambia la URL, así que si el estado se seteara por otro lado quedaría desincronizado con lo que la barra de direcciones dice.

Dos detalles que parecen de más y no lo son:

- **Una página inventada cae a la inicial** (`normalizar`). Sin eso, entrar a `#no-existe` mostraba el Dashboard igual —por el `?? Dashboard` de `App`— pero la URL seguía diciendo `#no-existe`: la barra de direcciones mintiendo sobre lo que hay en pantalla. Pasa con un link viejo a una pantalla que se renombró.
- **La normalización al montar usa `replaceState`, no escribe el hash.** Escribirlo agregaría una entrada al historial, y entonces el primer "atrás" del usuario no haría nada visible: volvería a la misma pantalla, sólo que sin hash.

Los ids válidos salen de las claves de `PAGES` en `App.jsx` y se pasan **por parámetro** al hook, en vez de importarlos: así el hook no se acopla a esa pantalla en particular. Agregar una pantalla a `PAGES` la hace navegable por `#id` sin tocar nada más.

---

## Lo que sobrevive a un F5 es la pantalla, no lo que estabas haciendo adentro

Decisión explícita de alcance. Sobrevive **la página**; se pierden los filtros, las búsquedas, los grupos desplegados y las **sub-vistas**:

| Estabas en… | Después del F5 |
|---|---|
| Usuarios, Preguntas, Reglas… | La misma pantalla ✅ |
| El historial de una persona | El listado de Usuarios |
| Editando el contenido de un módulo | La lista de Módulos |
| Usuarios con el filtro "Soldador" puesto | Usuarios sin filtros |

El motivo es de relación costo/beneficio: persistir el resto obliga a tocar **cada pantalla una por una** serializando su estado, y el valor cae rápido — perder un filtro molesta bastante menos que perder la pantalla entera, que era el problema real.

### La tab de SIMA CHECK no necesitó nada

Las tabs (Resumen, Módulos, Preguntas, Bases, Reglas, Asignaciones) **son páginas**, no un estado aparte: `BackofficeLayout` no tiene ningún `useState` y deriva la tab activa de `page`. Persistir la página persiste la tab sola.

### El early return del historial sigue funcionando, y por el mismo motivo que antes

Ver el historial de una persona **no toca el hash**, así que `page` sigue en `'usuarios'` y `Usuarios.jsx` nunca se desmonta — que es exactamente lo que ese early return existe para lograr (conserva la tab, la búsqueda y los usuarios ya cargados al volver). Mismo caso el editor de contenido de Módulos.

### ⚠️ La contracara: el botón "atrás" no sale de una sub-vista

Es la consecuencia directa del alcance elegido, y conviene tenerla escrita porque es **una expectativa nueva que este cambio crea**. Estando en el historial de una persona, "atrás" no vuelve al listado de Usuarios: vuelve a la pantalla anterior a Usuarios. Las sub-vistas no están en el historial del navegador porque no están en la URL.

Antes esto no confundía a nadie porque "atrás" no hacía nada en ningún lado. Ahora que funciona para las pantallas, es razonable que alguien espere que funcione también acá. Si molesta en la práctica, el arreglo es meter la sub-vista en el hash (`#usuarios/historial/42`) — y ahí sí empieza a parecerse a un router de verdad, con lo cual conviene decidirlo a propósito y no de arrastre.

Lo mismo, pero preexistente y sin relación con este cambio: estando en una sub-vista, hacer clic en el ítem del sidebar de esa misma pantalla **no hace nada** (navegar a la página en la que ya estás no dispara ningún cambio). Se sale con el botón "← Volver" de la propia vista.
