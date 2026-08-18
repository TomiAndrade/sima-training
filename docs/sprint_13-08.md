# Sprint 09 — Configuración de módulo y visibilidad

_Generado el 13-08-2026_

## Resumen

- Total de Stories: 14
- Story points totales: 41
- Prioridad Alta: 4 · Media: 6 · Baja: 4

**Línea de corte sugerida: después de la Story 9 (25 pts).** El sprint pasado fueron 44 puntos y se cortó en el 7. Hasta la 9 el sprint entrega la configuración de módulo completa, el storage de producción resuelto y las mejoras de listado. De la 10 a la 14 arrancan el siguiente.

## Orden de ejecución sugerido

1. Averiguar qué son el ID de vinculación y el número de usuario
2. Migrar el storage de imágenes a object storage
3. Configuración de evaluación por módulo
4. Aplicar el límite de reintentos y la espera entre intentos
5. Elegir bases de conocimiento al crear un módulo
6. Botón de actualizar en el historial de usuario
7. Achicar el listado de reglas de asignación
8. Rehacer la columna Módulos en el banco de preguntas
9. Buscador en los filtros con listas largas
10. Que recargar la página no vuelva al panel principal
11. Agregar feedback dentro de SIMA CHECK
12. Dashboard de SIMA CHECK con datos reales
13. Sacar `backendTypeBadge` de `sima-check`
14. Cerrar el registro de ingreso por QR

---

## Story 1 — Averiguar qué son el ID de vinculación y el número de usuario
**Prioridad:** Alta · **Estimación:** 1 pt

Spike. Aparecen dos identificadores distintos y no está claro cuál se muestra dónde ni cuál usa la gente para referirse a una persona. Va primero porque puede destapar algo que afecte otras pantallas.

**Tareas:**
- [x] Rastrear de dónde sale cada uno (`Usuario.id`, `Vinculacion.id`, ¿algún campo en `datos`?)
- [x] Ver dónde se expone cada uno hoy en el backoffice y en la tablet
- [x] Decidir cuál es el identificador que ve la gente y documentarlo
- [x] Anotar si hace falta cambiar algo, sin implementarlo en esta story

**Resultado:** los dos salen del mismo lugar — el diff del audit log en `HistorialUsuario.jsx`, que muestra `ID` (= `Vinculacion.id`) y `Usuario` (= `Usuario.id`), las dos PK `autoincrement`. El identificador de la gente es el **DNI**. Los dos arreglos que destapó se hicieron en el acto: las PK salieron del render del audit log, y el `legajo` —que se importaba y no lo leía ningún frontend— se eliminó junto con el jsonb `Usuario.datos` entero. Rastreo completo en [decisiones/usuarios.md](decisiones/usuarios.md#el-identificador-que-ve-la-gente-es-el-dni-y-es-el-único). No afecta a ninguna otra pantalla del sprint.

---

## Story 2 — Migrar el storage de imágenes a object storage
**Prioridad:** Alta · **Estimación:** 5 pts

Bloqueante de producción. `LocalDiskStorage` escribe en disco efímero: el primer redeploy borra todas las imágenes de preguntas y la base queda con claves que apuntan a nada.

**Tareas:**
- [x] Elegir proveedor (R2 vs S3) verificando precios actuales
- [x] Crear la cuenta y el bucket, con las credenciales en el `.env`
- [x] Escribir la implementación nueva de `StorageService` (~~la interfaz no cambia~~)
- [x] Verificar que subir, servir y borrar una imagen funcionan de punta a punta
- [x] Probar que un reinicio del servidor no pierde nada

**Resultado:** R2 sobre S3 por el egreso —R2 no lo cobra, S3 sí—, precios verificados contra las páginas oficiales el mismo día ($0 en las dos para almacenamiento a esta escala; la diferencia real está en servir imágenes a las tablets). `R2Storage` nueva, elegida por `STORAGE_DRIVER` en `StorageModule` (factory, no una constante de build — permite probar R2 real desde development).

**La premisa "la interfaz no cambia" era falsa.** Sirvió para estimar los 2 pts de una implementación nueva, pero `StorageService` sólo tenía `guardar`/`borrar` — nada podía **leer**. Hacía falta porque `main.ts` servía `/uploads` con `useStaticAssets`, que sólo sabe leer del disco local. Se agregó `leer(clave) → ArchivoLeido` (stream, no Buffer — no bufferear 2MB en RAM por cada tablet pidiendo a la vez) y un `UploadsController` nuevo que reemplaza al estático. La URL no cambió (`/uploads/preguntas/<uuid>.png` sigue igual con los dos drivers), así que ni el schema ni los frontends se tocaron — sólo se corrigió el tamaño real de la story.

**Decisión de scope que no estaba en la story: el backend sigue siendo intermediario, el bucket queda privado.** La alternativa (bucket público, la tablet baja directo de R2) era más rápida y liberaba banda del servidor, pero son fotos de instalaciones de clientes de Oil & Gas — se prefirió dejar el control de acceso en un solo lugar por si hace falta restringirlo. El costo medido es despreciable a esta escala y ese tráfico ya existía con `useStaticAssets`. Detalle completo en [decisiones/infraestructura.md](decisiones/infraestructura.md#storage-de-archivos).

**Verificación real, no simulada.** Primero un script descartable habló directo con el SDK de R2 (subir/leer/borrar) para validar las credenciales antes de escribir la implementación. Después, con la API real levantada (`STORAGE_DRIVER=r2`) y contra los endpoints HTTP de verdad: `POST /preguntas/imagen` → `GET /uploads/...` (bytes idénticos, headers correctos) → **se mató el proceso y se levantó uno nuevo** (simulando el redeploy que motivó la story) → la imagen subida antes seguía ahí → `DELETE /preguntas/imagen/:clave` → 404. Se repitió el mismo ciclo con `STORAGE_DRIVER=local` para confirmar que no se rompió el flujo de desarrollo. Se probó además path traversal contra `/uploads/*` (`../../.env`, variantes encoded) — todo 404 sin tocar el storage.

---

## Story 3 — Configuración de evaluación por módulo
**Prioridad:** Alta · **Estimación:** 5 pts

Hoy son 3 preguntas y 70% para todos los módulos, hardcodeado. Pasa a decidirlo quien crea el módulo. Las cuatro columnas entran en la misma migración aunque los reintentos se apliquen en la story siguiente.

**Tareas:**
- [x] ~~Migración: `cantidadPreguntas`, `umbralAprobacion`, `cantidadReintentos` y `esperaEntreIntentos` en `Modulo`~~
- [x] Sumar los campos al form de creación de módulo, con los valores de hoy como default
- [x] Que el sorteo del examen use `cantidadPreguntas` del módulo en vez de la constante
- [x] Que la corrección use el umbral del módulo, con la constante como fallback
- [x] Verificar que las sesiones viejas siguen mostrando el umbral con el que se rindieron
- [x] Specs del sorteo y de la corrección con umbral por módulo

**Resultado:** hecha antes de esta sesión (commits `9efdd38`/`93f134d`/`05a0cde`/`42de642`, previos al 13-08). **La primera tarea tenía la premisa incorrecta**: los cuatro campos son `Int?` en `ModuloVersion`, no en `Modulo` — se congelan con la versión (sólo editables en BORRADOR, `PUT /modulos/:id/parametros`) en vez de vivir en el contenedor estable, porque un parámetro de examen es algo que se publica y versiona, no metadata del módulo. `null` = default global (3 / 70% / sin tope / sin espera), nunca cero. `Sesion.umbralAprobacion` se congela por fila, así que las sesiones viejas no necesitaron migrarse. Detalle en `CLAUDE.md` (entidad `ModuloVersion`).

---

## Story 4 — Aplicar el límite de reintentos y la espera entre intentos
**Prioridad:** Alta · **Estimación:** 3 pts

Usa las dos columnas de la story anterior. Es la primera regla que puede impedir que alguien arranque una evaluación, así que el mensaje de rechazo importa tanto como la validación.

**Tareas:**
- [x] Decidir desde cuándo cuenta la espera (fin del intento anterior)
- [x] Validar en el endpoint del examen: sin intentos disponibles o dentro de la espera, no se entrega
- [x] Mensaje claro en la tablet: cuántos intentos quedan y desde cuándo puede volver
- [x] Decidir qué pasa con una sesión offline que llega y ya no tenía intentos
- [x] Specs de los dos límites

**Resultado:** hecha antes de esta sesión (commits `05a0cde`/`64c3d7a`). `tablet/reintentos.ts` (funciones puras) + 409 en `TabletService.examen()`. La decisión sobre offline: **el tope se valida sólo al servir el examen, no al registrar la sesión** — `SesionesService.crearSesion()` no revalida nada, para que una rendición offline sincronizada tarde no se caiga por una ventana de espera ya vencida. El costo aceptado (alguien con el token y `curl` puede saltear el tope) queda anotado en `pendientes.md`.

---

## Story 5 — Elegir bases de conocimiento al crear un módulo
**Prioridad:** Alta · **Estimación:** 3 pts

Hoy el módulo se crea y recién después, entrando a editar contenido, se le pueden poner criterios. Se agrega el selector al modal de creación. El endpoint ya existe.

**Tareas:**
- [x] Sumar el selector de base y nivel al modal de creación de módulo
- [x] Llamar a `PUT /modulos/:id/criterios` después de crear, si se eligió alguna
- [x] Mostrar cuántas preguntas materializa cada criterio antes de confirmar
- [x] Que crear sin criterios siga siendo válido

**Resultado:** hecha antes de esta sesión (commit `42de642`). El modal de creación quedó armando el módulo entero de una pasada — metadata + `ParametrosExamenPanel` (Story 3) + `CriteriosPanel` + picker de preguntas del banco, los tres opcionales. El submit son tres llamadas secuenciales (`POST /modulos` → preguntas manuales → criterios) y si falla un paso intermedio el módulo queda como borrador en vez de perderse, con el error dentro del modal. Detalle en `CLAUDE.md` (pantalla Módulos, "+ Nuevo módulo").

---

## Story 6 — Botón de actualizar en el historial de usuario
**Prioridad:** Baja · **Estimación:** 1 pt

Después de que alguien rinde en la tablet hay que salir y volver a entrar para ver el resultado. Un botón que vuelva a pedir el informe alcanza.

**Tareas:**
- [x] Botón que vuelve a llamar a `GET /usuarios/:id/informe`
- [x] Indicador de carga mientras refresca, sin desmontar lo que ya se ve

**Resultado:** botón "↻ Actualizar" arriba, al lado de "← Volver a Usuarios". La trampa era que `loading` y `error` son early returns que reemplazan la pantalla entera, así que reusar el `reintentar()` existente hubiera hecho exactamente lo que la story pide evitar; el refresco tiene su propio par `refrescando`/`errorRefresco`. Si falla, banner arriba y los datos de la última carga quedan abajo. Ver [decisiones/asignaciones.md](decisiones/asignaciones.md#la-vista-de-historial-early-return-y-coreformat).

---

## Story 7 — Achicar el listado de reglas de asignación
**Prioridad:** Baja · **Estimación:** 2 pts

El acordeón lista todos los centros activos, incluidos los que no tienen ninguna regla. Con el catálogo real eso es una lista larga de filas vacías.

**Tareas:**
- [x] Mostrar solo los centros que tengan al menos una regla
- [x] Buscador por nombre de centro
- [x] Que los centros sin reglas sigan siendo alcanzables (toggle o mensaje), porque detectar centros sin capacitación configurada era el motivo original de listarlos

**Resultado:** los centros sin reglas se fueron a un bloque plegado al pie que los **cuenta con el bloque cerrado** — así el dato que justificaba listarlos ("faltan 13") se sigue leyendo sin abrir nada. Adentro, cada uno con "Configurar", que abre el alta con el centro ya elegido (no "Editar módulos": sin reglas no hay alcance sobre el que operar). El buscador atraviesa los dos bloques, porque si sólo filtrara el de arriba, buscar un centro sin reglas devolvería "sin coincidencias" — justo el que se quiere encontrar. Ver [decisiones/asignaciones.md](decisiones/asignaciones.md#el-listado-de-reglas-muestra-sólo-los-centros-configurados-pero-sigue-contando-los-otros).

---

## Story 8 — Rehacer la columna Módulos en el banco de preguntas
**Prioridad:** Baja · **Estimación:** 2 pts

Hoy la columna muestra todos los badges y se desborda cuando una pregunta está en varios módulos.

**Tareas:**
- [x] ~~Mostrar el módulo al que se asignó primero~~, más un contador del resto
- [x] Desplegable en la fila con la lista completa
- [x] Mantener el badge de activa/inactiva por módulo

**Resultado:** badge del primer módulo + chip `+N` que despliega el resto en la fila, mismo patrón que los pares adicionales de Usuarios. La tabla pasa a `alignTop` por el mismo motivo que aquella.

**Ojo — "el módulo al que se asignó primero" no existe.** `ModuloVersionPregunta` no tiene ningún timestamp (`orden` es la posición de la pregunta *dentro* del módulo, no sirve), y el `findMany` que arma esos pivots no lleva `orderBy`, así que el orden hoy es el que devuelva Postgres y puede cambiar entre requests — mostrando un solo badge eso haría saltar *cuál* es el visible entre dos cargas. Se ordena en el cliente: **activas primero, después por nombre**. Lo primero evita que un módulo tachado quede como la única cara visible mientras el `+N` esconde los activos. El `orderBy` que falta del lado del backend quedó anotado en [pendientes.md](pendientes.md#backend). Ver [decisiones/preguntas.md](decisiones/preguntas.md#la-columna-módulos-muestra-uno-solo-y-el-orden-lo-decide-el-cliente).

---

## Story 9 — Buscador en los filtros con listas largas
**Prioridad:** Media · **Estimación:** 3 pts

Con 88 puestos y 16 centros, un select plano es inusable. `MultiSelectFilter` ya tiene buscador; los que faltan son los selects simples.

**Tareas:**
- [x] Inventariar qué filtros tienen buscador y cuáles no
- [x] Decidir si se extiende `MultiSelectFilter` a selección única o se hace un componente aparte
- [x] Aplicarlo en Usuarios (puesto, centro, ~~organización~~)
- [x] ~~Aplicarlo en Bases~~ y en donde haya quedado alguno suelto

**Resultado:** componente nuevo `SearchableSelect` (selección única con buscador), aparte de `MultiSelectFilter` — casi todo lo que los diferencia son comportamientos opuestos (seleccionar todos vs opción vacía, quedarse abierto vs cerrar al elegir), así que un prop `single` dejaba la mitad del componente detrás de condicionales.

Aplicado **sólo donde la lista es larga**: Puesto (88) y Centro de costo (16), en los cuatro lugares donde aparecen — filtros de Usuarios, `ParesPuestoCentro`, el resolver de `ImportUsuariosModal` y el modal de Reglas. Los dos últimos **no estaban en la story** y son los mismos 88 puestos en el flujo de carga de nómina.

**Dos cosas de la story que el inventario contradijo.** `BasesConocimiento.jsx` **no tiene ningún `<select>`** — "aplicarlo en Bases" sólo podía referirse a los selects de base/nivel de Preguntas y los modales, que son listas cortas. Y organización tampoco entró: hoy hay una sola. En los cortos abrir un panel con un buscador que no filtra nada agrega un paso en vez de sacarlo; el criterio es el largo de la lista, no la consistencia visual.

**El panel va en portal.** El cuerpo de `Modal` es `overflow-y-auto` y recorta cualquier cosa flotante, y la mitad de los consumidores viven dentro de un modal. Ver [decisiones/usuarios.md](decisiones/usuarios.md#searchableselect-es-un-componente-aparte-de-multiselectfilter-no-un-prop).

---

> **Línea de corte sugerida — 25 pts hasta acá.**

---

## Story 10 — Que recargar la página no vuelva al panel principal
**Prioridad:** Media · **Estimación:** 3 pts

El backoffice no usa router a propósito y la navegación vive en `useState`, así que F5 pierde dónde estabas. Hay que persistir la página actual sin meter react-router.

**Tareas:**
- [x] Decidir el mecanismo: hash en la URL o `sessionStorage`
- [x] Persistir la página ~~y la tab de SIMA CHECK~~
- [x] Definir qué pasa con el estado interno de una pantalla (filtros, historial abierto): se pierde y está bien, o se persiste también
- [x] Verificar que no rompe el early return de Ver historial

**Resultado:** hash (`#usuarios`), no `sessionStorage`. Se eligió por dos cosas que el usuario ve y `sessionStorage` no da: la dirección **se puede compartir**, y el **botón "atrás" del navegador funciona** (antes no hacía nada). Encima `sessionStorage` muere al abrir una pestaña nueva, así que ni siquiera cubría bien el caso. **No es react-router**: no hay rutas anidadas, params, `<Link>` ni matching — es una variable que pasó de la memoria a la barra de direcciones.

**La segunda tarea eran dos cosas y es una sola.** La tab de SIMA CHECK **no es un estado aparte**: las tabs *son* páginas y `BackofficeLayout` no tiene ningún `useState` — deriva la tab activa de `page`. Persistir la página persiste la tab sola, sin código extra.

**Alcance: la pantalla + el historial de una persona.** Se hizo en dos pasadas — primero sólo la pantalla, y al ver la consecuencia (que "atrás" no salía del historial) se sumó la sub-vista, que vive en el sub del hash: `#usuarios/historial/42`. `historialId` pasó de `useState` a **derivarse de la URL**, así que la única fuente de verdad vuelve a ser una sola.

Los filtros y las búsquedas **sí** se pierden con el F5, a propósito: persistirlos obliga a tocar cada pantalla una por una serializando su estado, y el valor cae rápido comparado con perder la pantalla entera.

**El early return sigue intacto, que era lo que había que no romper**: `#usuarios` y `#usuarios/historial/42` son la misma *página* para `App.jsx`, que renderiza el mismo componente en los dos casos. `Usuarios.jsx` no se desmonta al entrar ni al salir del historial, así que volver sigue conservando la tab, la búsqueda y los usuarios ya cargados.

**De yapa se arregló una molestia preexistente**: estando en el historial, tocar "Usuarios" en el sidebar antes no hacía nada (navegar a la página en la que ya estás no dispara nada). Ahora el hash cambia y vuelve al listado.

⚠️ **El editor de contenido de un módulo quedó afuera a propósito**, y no por falta de ganas: tiene cambios sin guardar en memoria (`flushCambios()`), así que un F5 se los lleva igual. Restaurar la vista sin los cambios mostraría el editor abierto como si siguieras editando cuando el trabajo ya no está — peor que caer en la lista, que al menos es honesto. Anotado en `pendientes.md`. Ver [decisiones/navegacion.md](decisiones/navegacion.md).

---

## Story 11 — Agregar feedback dentro de SIMA CHECK
**Prioridad:** Media · **Estimación:** 3 pts

Que quien rinde pueda reportar una pregunta mal redactada o dejar un comentario. Es la única vía para detectar preguntas malas: hoy solo se ve el score.

**Tareas:**
- [ ] Definir el alcance: reporte por pregunta, comentario libre al final, o los dos
- [ ] Modelar la entidad y su migración
- [ ] Endpoint que lo recibe, con el usuario saliendo del token
- [ ] UI en la tablet, sin interrumpir la evaluación
- [ ] Dónde se lee el feedback en el backoffice

---

## Story 12 — Dashboard de SIMA CHECK con datos reales
**Prioridad:** Media · **Estimación:** 8 pts

El Resumen es casi todo mock: KPIs, gráfico de aprobación y últimas evaluaciones. Necesita endpoints de agregados que hoy no existen — no hay nada que liste sesiones o asignaciones de toda la gente.

**Tareas:**
- [ ] Definir qué métricas van y cuáles se descartan
- [ ] Endpoint de agregados: aprobación por módulo, gente con módulos vencidos, evaluaciones recientes
- [ ] Decidir si se calcula al vuelo o se cachea (mirar el costo de las queries con la nómina completa)
- [ ] Reemplazar los StatCards mockeados por los datos reales
- [ ] Gráfico de aprobación contra datos reales, no contra el array literal de nombres
- [ ] Definir el refresco: al entrar, o polling cada N segundos
- [ ] Borrar los mocks que queden sin consumidor y actualizar `CLAUDE.md`

---

## Story 13 — Sacar `backendTypeBadge` de `sima-check`
**Prioridad:** Baja · **Estimación:** 1 pt

`core/components/ImportPreguntasModal.jsx` importa de `sima-check/`, violando la regla de dependencia. Es anterior al sprint pasado y el arreglo es el mismo que se le hizo a `formatVersionNumero`.

**Tareas:**
- [ ] Mover el helper a `core/format/` (ojo: devuelve JSX, así que el archivo tiene que ser `.jsx`)
- [ ] Actualizar los imports y verificar que no queda ningún puente
- [ ] Correr el build

---

## Story 14 — Cerrar el registro de ingreso por QR
**Prioridad:** Baja · **Estimación:** 1 pt

El formulario ya está armado. Falta generar el QR, imprimirlo y probarlo. No toca el repo.

**Tareas:**
- [ ] Generar el QR estático apuntando a la URL del formulario
- [ ] Verificar escaneando que la URL sea la de Google y no la de un intermediario
- [ ] Imprimirlo con margen blanco y un texto arriba que diga qué es
- [ ] Probar el escaneo desde un celular a distancia real

---

## Notas / dudas

- **"Y mostrar fecha en…" quedó cortado.** La nota de F5 termina ahí. ¿Fecha en el header del backoffice, en la fila de cada usuario, en el historial? Sin eso no se puede estimar.
- ~~**Reintentos y espera chocan con el modo offline.**~~ Resuelto en la Story 4: el tope se valida sólo al servir el examen, no al registrar la sesión — una rendición offline sincronizada tarde no se cae por una ventana de espera ya vencida. El costo aceptado (se puede saltear con `curl` y el token) queda en `pendientes.md`. Lo que sigue sin responder Eduardo es otra cosa: qué score mostrarle a alguien que rindió sin conexión (ver `pendientes.md` → Producto/negocio).
- **El umbral por módulo ya estaba previsto.** `Sesion.umbralAprobacion` se congela por fila desde la Story 4, y el comentario de `corregir.ts` dice que `UMBRAL_APROBACION_DEFAULT` pasa a ser el fallback el día que sea por módulo. No hay que migrar sesiones viejas.
- **"Dashboard en tiempo real" necesita definición.** Refrescar al entrar es una cosa; polling cada N segundos es otra; websockets es otra escala de trabajo. Se asumió polling simple.
- **Feedback en SIMA CHECK: falta el qué.** ¿Feedback sobre una pregunta puntual, sobre la evaluación entera, o un campo libre? Se asumió reporte por pregunta + comentario libre al final.
- ~~**El buscador en filtros es menos trabajo del que parece.**~~ El inventario de la Story 9 corrigió esta nota: `BasesConocimiento.jsx` **no tiene ningún `<select>`** (la nota original estaba equivocada), y `MultiSelectFilter` ya tenía buscador. Terminó siendo `SearchableSelect`, componente nuevo, aplicado a Puesto y Centro de costo en los 4 lugares donde aparecen.
- **El Dashboard real cubre parte de la deuda de mocks.** Quedan afuera Clientes y el Resumen de SIMA CHECK.
- ~~**Object storage sigue sin proveedor decidido.**~~ R2, resuelto en la Story 2 — precios verificados contra las páginas oficiales el mismo día, no de memoria.
- **Faltan las respuestas de Eduardo.** Las de PIN, offline y catálogo de puestos no están registradas en el repo. Varias stories dependen de eso.
