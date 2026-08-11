# Decisiones — Módulos, versionado y composición por criterio

Cubre `Modulo` y `ModuloVersion` (el versionado inmutable y su numeración pública), el pivot `ModuloVersionPregunta` con sus dos orígenes, `ModuloVersionCriterio` (declarar qué evalúa un módulo en vez de enumerar preguntas), y el editor de contenido del backoffice.

**No cubre**: el banco de preguntas que estos módulos consumen ni su clasificación ([preguntas.md](./preguntas.md)). Tampoco quién tiene que rendir un módulo ([asignaciones.md](./asignaciones.md)) ni qué pasa cuando alguien lo rinde ([sesiones.md](./sesiones.md)).

---

## Versionado

### `Modulo` es un contenedor estable; el contenido vive en `ModuloVersion`

Un módulo **nunca se edita en el lugar**: cambiar su contenido crea una versión nueva, y la anterior queda `ARCHIVADO` e inmutable. No se pierden versiones viejas, y un score sólo significa algo contra el set de preguntas que estaba publicado en ese momento.

`Modulo.activo` es la baja lógica del módulo entero y es **independiente** del ciclo BORRADOR/ACTIVO/ARCHIVADO de sus versiones: el admin lo retira o lo reactiva a mano.

### Numeración pública `AÑO.MAYOR.MENOR`

Ej. `2026.01.00`, distinta del `numeroVersion` interno (un contador monotónico de creación que sólo sirve para ordenar). El número público **se asigna recién al Activar**; un borrador sin publicar no tiene número y se muestra como "Borrador".

- **Actualización** (misma línea) sube MENOR: `2026.01.00 → 2026.01.01`.
- **Versión nueva** sube MAYOR y resetea MENOR: `→ 2026.02.00`.
- MAYOR es la secuencia del módulo **por año**: la primera publicación del año es `01`.

### La elección actualización/versión nueva se decide al Activar, no al crear el borrador

Se probó primero al revés —se preguntaba al crear el borrador y se guardaba de entrada— y se cambió porque **no tiene sentido comprometerse a esa elección antes de saber cuánto se va a terminar modificando**.

Hoy `crearVersion` no recibe `esNuevaLinea` ni lo persiste: `activar(moduloId, esNuevaLinea?)` lo recibe y recién ahí lo escribe. Es obligatorio (el service tira 409 si falta) **únicamente cuando ya hay un ACTIVO publicado** del cual derivar el número; en la primera publicación no hay de qué elegir y queda `null`.

Es también el motivo por el que **no existe** un endpoint para cambiar la elección a mitad de edición: el que había se eliminó por completo, porque ahora todo pasa por el modal de Activar.

### A lo sumo un BORRADOR y un ACTIVO por módulo

`crearVersion` rechaza si ya hay un borrador en curso —hay que activarlo o cancelarlo primero— o si no hay un ACTIVO del cual partir (la primera publicación no pasa por acá: se edita directo la v1 y se activa).

Crea el borrador **copiando los pivots del ACTIVO**, así el punto de partida de la edición es el contenido publicado y no uno vacío.

### `activar` es transaccional

En la misma transacción: calcula el número según el `esNuevaLinea` recibido y el ACTIVO base, pasa el borrador a `ACTIVO` con ese número + `activadaEn`, y el ACTIVO anterior (si había) a `ARCHIVADO`. **Nunca quedan dos ACTIVO simultáneos.**

### `cancelarBorrador` descarta el borrador, y borra el módulo si era su única versión

Borra el `ModuloVersion` en BORRADOR, sus pivots y sus criterios —las FK son `ON DELETE RESTRICT`, así que hay que borrar los hijos antes que la versión, en una transacción—.

Si el módulo tenía un ACTIVO, queda tal cual estaba antes de empezar a editar. Si el borrador era su **única** versión (el módulo nunca se publicó), no tiene sentido un módulo sin ninguna versión, así que la misma operación **borra el `Modulo` entero**. Es el mismo endpoint y el mismo método para los dos casos: el backoffice sólo cambia el label del botón ("Cancelar borrador" vs "Eliminar módulo").

### Unassign duro vs baja lógica: cuándo usar cada uno

Son acciones independientes, no una reemplaza a la otra:

| | `setPreguntaActiva` (Desactivar) | `unassignPregunta` (Quitar) |
|---|---|---|
| Qué hace | Togglea `activa` en el pivot | **Borra el pivot** |
| Dónde vale | Borrador **y** versión publicada | **Sólo BORRADOR** (409 si no) |
| Reversible | Sí, la fila queda | No, hay que reasignar desde el banco |

El hard-delete está limitado al borrador porque borrar un pivot de una versión ACTIVO o ARCHIVADO **rompería la inmutabilidad del historial**. El toggle, en cambio, sí puede correr sobre lo publicado: es reversible y no reescribe qué preguntas tuvo esa versión.

### `versionParaEditar` vs `ultimaOActivaVersion`

`versionParaEditar` devuelve el **BORRADOR en curso si existe** y, si no, la vigente publicada. La usan `findOne`, `asignarPreguntas`, `setPreguntaActiva` y `unassignPregunta` — o sea todo lo que **edita** contenido.

Existe porque antes no era así y eso causaba un bug concreto: con un ACTIVO y un BORRADOR coexistiendo, `asignarPreguntas` apuntaba al borrador pero `setPreguntaActiva` a la vigente, así que togglear una pregunta desde la pantalla de Preguntas afectaba por error a la **versión publicada** en vez de al borrador en edición.

`ultimaOActivaVersion` (ACTIVO-o-última, ignora si hay un borrador) sigue existiendo sin cambios para los reportes y el enriquecimiento de `PreguntasService` —"qué módulos publicados tiene esta pregunta"—: ahí sí interesa lo publicado y no el trabajo en progreso.

### `findVersiones` devuelve `preguntasCount`, no las preguntas

Para el historial alcanza con cuántas hay; el detalle de una versión puntual con su contenido es un endpoint aparte (`GET /:id/versiones/:versionId`), reservado para cuando el backoffice necesita mostrarlo. Evita traer preguntas de más al listar el historial.

### Compartir un borrador como versión beta (diseñado, sin implementar)

Para que un tester pruebe un borrador sin activarlo ni ensuciar las estadísticas de la versión publicada. La forma esbozada es un `betaToken` sobre el `ModuloVersion` en BORRADOR más un endpoint público que sirva sus preguntas.

Queda anotado acá porque la forma ya está pensada, pero el estado y el bloqueo viven en [`../pendientes.md`](../pendientes.md).

---

## Composición por criterio

Hasta acá una `ModuloVersion` se armaba enumerando preguntas una por una. Ahora puede además declarar **qué evalúa** (`ModuloVersionCriterio`: base + nivel opcional) y dejar que el backend materialice el pool.

Los dos caminos **conviven**: el pivot lleva `origen` (`CRITERIO` / `MANUAL`), y eso es exactamente lo que permite que la resolución sepa qué filas le pertenecen.

### `cantidadPreguntas` se sacó del diseño

Iba a ser cuántas preguntas sortear por examen de cada criterio, pero **no tiene consumidor**: el sorteo toma una cantidad fija y no lee nada del criterio. Guardarlo ahora lo dejaba como un campo que se persiste, aparece en formularios y no gobierna ninguna regla — la situación exacta que tuvo `Modulo.vigenciaMeses` hasta que la vigencia lo usó de verdad.

Se agrega como columna nullable, sin backfill, cuando exista el sorteo real. Lo que se pierde mientras tanto es la **garantía de cobertura por criterio** (tomar N del pozo unificado puede dar 3 de residuos y 0 de altura), que es un problema **del sorteo** y no de la composición: la clasificación de cada `Pregunta` alcanza para reintroducir la cuota sin remodelar nada. Ver [`../pendientes.md`](../pendientes.md).

### El pool materializa TODAS las preguntas que matchean, no una muestra

Congelar unas pocas haría que todos los alumnos rindan exactamente las mismas y se pierde la aleatorización.

### Snapshot, no receta viva

`PUT /:id/criterios` materializa los pivots sobre el BORRADOR, y `activar()` los publica **sin volver a resolver** (hay un spec que lo fija).

Resolver al rendir dejaría a una versión `ARCHIVADO` como un puntero a un pozo que se mueve por debajo, y no se podría reconstruir qué se pudo tomar en una fecha — que es **todo el motivo del versionado**.

**Costo aceptado y verificado**: una pregunta cargada después de publicar no entra sola ni a la versión publicada ni al borrador que se cree a partir de ella. Entra recién cuando el admin vuelve a guardar los criterios, y hoy no hay nada que lo señale (anotado en [`../pendientes.md`](../pendientes.md)).

### La resolución es un UPSERT, no un replace

Ahí está toda la sutileza:

| Caso | Acción |
|---|---|
| Matchea y ya tiene pivot `CRITERIO` | **No se toca** — preserva un `activa: false` puesto a mano, y hace la resolución idempotente |
| Matchea y no tiene ningún pivot | Se inserta `origen: CRITERIO`, `activa: true`, `orden = max+1` |
| Pivot `CRITERIO` que ya no matchea | **Se borra**, esté activo o desactivado |
| Pivot `MANUAL` | **Nunca se toca** (misma regla que `recalcular()` con las `Asignacion` MANUAL) |

El pivot `CRITERIO` huérfano se borra **aunque estuviera desactivado a mano** porque es estado derivado: sacado el criterio se queda sin ninguna razón de estar, y desactivado sería una fila invisible-pero-presente que alguien puede reactivar sin nada que la respalde.

Se descartó **promoverlo a `MANUAL`**: reescribe el origen en silencio y deja sin respuesta *"¿qué trajo el criterio?"*. Si la pregunta igual importa, se vuelve a agregar desde el banco y queda `MANUAL`, que es la verdad.

Una pregunta que **ya es `MANUAL`** y además matchea un criterio conserva su origen: no se pueden tener dos filas (la PK es (versión, pregunta)) y pisarle el origen sería justamente tocar una MANUAL.

### El pool sólo toma preguntas activas

Y es **literalmente el mismo filtro** que `GET /preguntas?baseId=&nivelId=&activa=true`, a propósito: el backoffice previsualiza el conteo con ese endpoint, y por eso no hizo falta uno de dry-run.

Corolario: mandar una pregunta a papelera la saca del pool, y la resolución siguiente **borra** su pivot `CRITERIO`. Recuperarla no la devuelve sola al módulo, pero la resolución siguiente sí.

### Un criterio que matchea CERO preguntas se guarda igual

Con el conteo en 0 y un badge de aviso. Declarar el tema **antes** de cargar las preguntas es un flujo válido, y rechazarlo obligaría a cargar preguntas para poder declarar qué se evalúa. Tampoco bloquea Activar: publicar un módulo sin preguntas ya era posible.

### Unicidad: `@@unique` de Prisma MÁS un índice parcial a mano

El `@@unique([moduloVersionId, baseConocimientoId, nivelId])` cubre sólo la mitad `nivel_id NOT NULL`: en Postgres dos NULL nunca colisionan, así que no impide declarar dos veces "cualquier nivel de esta base". Esa otra mitad la cubre `modulo_version_criterio_base_sin_nivel` (`WHERE nivel_id IS NULL`).

A diferencia de `ReglaAsignacion` —que dropeó su `@@unique` entero porque `deleted_at` atraviesa los dos alcances ([asignaciones.md](./asignaciones.md#la-unicidad-vive-en-dos-índices-parciales-y-la-tabla-no-declara-ningún-unique))— acá no hay soft-delete y el `@@unique` plano se conserva.

Las cuatro combinaciones (nivel de otra base, dos "cualquier nivel", dos niveles distintos, el mismo dos veces) se verificaron con `INSERT` directo antes de escribir el service: son constraints que **ningún spec con Prisma mockeado puede ejercitar**.

### `unassignPregunta` rechaza con 409 los pivots `CRITERIO`

Quitarla a mano no sirve: la resolución siguiente la vuelve a materializar.

El mensaje dice que la vía es **"Desactivar"** y —lo que importa— que **esa baja sobrevive a las resoluciones siguientes**. Sin esa segunda mitad, alguien que quiere sacar UNA pregunta termina borrando el criterio entero y se lleva puestas todas las demás. Hay un spec que fija las dos partes del mensaje con regex.

---

## Frontend: el editor de contenido

### El editor del borrador es staged: nada se manda hasta "Guardar y volver" o "Activar"

Se probó primero al revés —cada acción (asignar, activar/desactivar, quitar) pegaba al backend al toque— y se cambió: armar el contenido de un módulo son muchos movimientos chicos, y cada uno con su ida y vuelta a la red hacía la pantalla lenta e imposible de arrepentirse.

`localAsignadas` es una copia editable que arranca como foto del servidor **una sola vez por sesión de edición** (una `sessionKeyRef` con `${moduleId}:${versionId}` evita retomar la foto en cada render). Los handlers de fila sólo mutan ese estado local, sin `await` ni loading.

`flushCambios()` diffea la foto del servidor contra lo armado y dispara la **mínima** cantidad de llamadas: `unassignPregunta` para lo sacado, `asignarPreguntas` para lo nuevo, `setPreguntaActiva` para lo que cambió de estado. La usan tanto "Guardar y volver" como "Activar" — que primero flushea y recién después publica, para que lo publicado incluya los cambios de la sesión.

Los modales de asignar/crear pregunta ganaron un callback opcional: si el padre lo pasa, el modal le **devuelve lo elegido** en vez de pegarle al backend él mismo. La vista por módulo de la pantalla de Preguntas no lo pasa y sigue guardando de inmediato — ese camino no es staged.

### "Descartar" es liviano, salvo un caso

Como nada se mandó al servidor durante la sesión, descartar cuando el módulo **ya tiene un ACTIVO** publicado es sólo no flushear y navegar: el borrador queda con lo que tenía guardado de sesiones anteriores.

La excepción es el módulo **nunca publicado**: ahí no hay ACTIVO al cual volver, así que "Descartar" delega en el flujo completo de cancelar borrador, que elimina el módulo entero. El botón standalone sigue siendo la única vía para tirar sesiones ya guardadas antes, no sólo la actual.

### Recomendar "versión nueva" se muestra dentro del modal de Activar

Se compara el borrador contra el ACTIVO del que partió (preguntas activas agregadas + quitadas). Si los cambios llegan a un mínimo **y** son ≥30 % de las preguntas de la base, al abrir el modal —con "Actualización" seleccionada, que es el default— aparece una advertencia sugiriendo elegir "Versión nueva" en su lugar.

Va ahí y no durante la edición porque es el momento en que la elección se toma: el usuario clickea la otra opción antes de confirmar y listo, sin ningún endpoint aparte para "cambiar de opinión".

Sin este aviso, alguien podría encadenar puras "actualizaciones" hasta que el módulo termine siendo completamente distinto sin que la línea mayor lo refleje nunca. El umbral es una heurística simple, ajustable si en la práctica resulta muy sensible o muy laxa.

### La vista de solo-lectura se reusa para dos casos

Ver las preguntas del ACTIVO vigente, y ver el detalle de una versión archivada del historial. Los dos son "mostrar el contenido de una versión puntual sin poder editarlo", sólo cambia de qué versión — no hacía falta duplicar la UI.

### `CriteriosPanel` guarda al toque, y el usuario lo ve

Es la excepción al staging: tiene su propio botón "Guardar criterios" que pega al backend al confirmar. Que convivan dos modelos de guardado en la misma pantalla es tolerable **sólo si el usuario los ve**, así que el modal de confirmación dice que esto se guarda ahora mismo y, si hay cambios de preguntas sin guardar, avisa que se guardan junto con los criterios. `flushCambios()` nunca corre sin que eso esté escrito.

**El guardado es de tres pasos y termina en un re-baseline.** El `PUT` materializa pivots **en el servidor**, así que después las dos fotos del staging quedan viejas. Refrescar sólo la del servidor sería **peor que no hacer nada**: el flush siguiente vería los pivots recién materializados en el "antes" pero no en el "ahora", y los borraría. Por eso: (1) flush, (2) `PUT`, (3) invalidar la `sessionKeyRef` y recargar, que hace que el efecto de staging vuelva a snapshotear las dos fotos desde el servidor.

**El paso 3 va en `finally`, no en el camino feliz.** Si el flush se aplica y el `PUT` falla —409 porque otra sesión publicó la versión, un corte de red—, el servidor ya tiene los cambios de preguntas y la foto local no: el flush siguiente intentaría des-asignar un pivot que ya no existe y moriría con un 404. Resincronizar siempre cuesta perder las filas de criterios que se estaban editando, y a cambio deja la sesión consistente; el mensaje de error lo dice. Por eso el error se muestra **en el panel y no en el modal**: el modal se cierra y el contenido se recarga, así que el mensaje tiene que estar al lado de los criterios ya resincronizados.

**El conteo total es UNIÓN, no suma.** Dos criterios pueden pisarse ("cualquier nivel de Seguridad" + "Seguridad-Básico") y el backend los unifica en un `Set`; sumar los conteos por fila daría un total que no coincide con los pivots resultantes. Por eso el panel guarda los **ids** que devuelve el endpoint, no el `length`.

### Las filas por criterio no ofrecen "Quitar"

En el panel de preguntas asignadas, las filas con `origen: CRITERIO` llevan badge **"Por criterio"** y sólo ofrecen "Desactivar". El 409 del backend es el backstop, no la primera línea de defensa.

### Dónde viven los helpers del banco

`bancoModulo.jsx` existe para no romper la regla `react-refresh/only-export-components`: los helpers y el hook viven ahí en vez de en el componente que los usa, porque un archivo que exporta componentes no puede exportar otras cosas sin romper el fast refresh. Es también el motivo por el que `claveCriterio` —la identidad `base::nivel ?? '*'`, que hace colisionar nivel ausente con `null`— está ahí y no en `CriteriosPanel`.
