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

## Qué sobrevive a un F5: la pantalla y el historial de una persona, no los filtros

| Estabas en… | Después del F5 |
|---|---|
| Usuarios, Preguntas, Reglas… | La misma pantalla ✅ |
| El historial de una persona | **El mismo historial** ✅ |
| Editando el contenido de un módulo | La lista de Módulos (a propósito, ver abajo) |
| Usuarios con el filtro "Soldador" puesto | Usuarios sin filtros |

Los filtros, las búsquedas y los grupos desplegados **se pierden**, y eso es deliberado: persistirlos obliga a tocar cada pantalla una por una serializando su estado, y el valor cae rápido — perder un filtro molesta bastante menos que perder la pantalla entera, que era el problema real.

### La tab de SIMA CHECK no necesitó nada

Las tabs (Resumen, Módulos, Preguntas, Bases, Reglas, Asignaciones) **son páginas**, no un estado aparte: `BackofficeLayout` no tiene ningún `useState` y deriva la tab activa de `page`. Persistir la página persiste la tab sola.

### El historial de una persona vive en el sub del hash

`#usuarios/historial/42`. `Usuarios.jsx` recibe `sub`/`setSub` y **deriva `historialId` de ahí en vez de tenerlo en un `useState`** — la URL vuelve a ser la única fuente de verdad, igual que para la página.

Un id no numérico (alguien editando la URL a mano) cae a `null` y muestra el listado, en vez de pedirle a la API un `/usuarios/undefined`.

**El early return sigue haciendo lo que hacía**, y esto es lo que había que no romper: `#usuarios` y `#usuarios/historial/42` son **la misma página** para `App.jsx`, que renderiza el mismo componente en los dos casos. `Usuarios.jsx` nunca se desmonta al entrar o salir del historial, así que volver conserva la tab, la búsqueda y los usuarios ya cargados — que es exactamente para lo que ese early return existe.

De yapa se arregló una molestia preexistente: estando en el historial, tocar "Usuarios" en el sidebar **antes no hacía nada** (navegar a la página en la que ya estás no dispara ningún cambio). Ahora el hash sí cambia —`#usuarios/historial/42` → `#usuarios`— así que vuelve al listado.

### ⚠️ El editor de contenido de un módulo NO se restaura, y no es por falta de ganas

Es la otra sub-vista del backoffice (`TrainingModules.jsx`) y quedó afuera **a propósito**, porque no es simétrica con el historial:

- **El historial es de sólo lectura.** Restaurarlo es ganancia pura: se vuelve a pedir el informe y listo.
- **El editor tiene trabajo sin guardar en memoria.** Asignar preguntas, quitarlas y activarlas/desactivarlas viven en el cliente hasta "Guardar y volver" (`flushCambios()`). Un F5 se lleva esos cambios **inevitablemente** — son estado del cliente, no están en ningún lado.

Restaurar la vista sin los cambios sería **peor que caer en la lista**: mostraría el editor abierto, como si siguieras a mitad de editar, cuando tu trabajo ya no está. La pantalla mentiría. Caer en la lista de módulos es honesto: se perdió, y se ve que se perdió.

Si alguna vez se quiere que sobreviva, lo que hay que resolver primero es **persistir el staging**, no la URL — y ahí la pregunta es si conviene eso o directamente que el editor guarde a medida que se toca, que es otra decisión de producto.
