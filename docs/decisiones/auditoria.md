# Decisiones — Auditoría

Cubre `AuditLog`: qué entidades se auditan y cuáles no, quién queda registrado como actor (el string de canal y la identidad real), qué datos personales se redactan y cuáles jamás se guardan, por qué se guarda un diff y no un snapshot, por qué la tabla es polimórfica, cómo se agrupan en una sola fila los cambios que tocan muchas filas de base, y cómo se leen el historial de una persona y el log global.

**No cubre**: la pantalla que consuma el log global — `GET /audit-log` existe y está probado, pero todavía no tiene UI en el backoffice (queda para otra sesión). El render del diff que sí existe hoy (la hoja de vida de una persona) es parte de [asignaciones.md](./asignaciones.md#la-vista-de-historial-early-return-y-coreformat). El borrado físico de los pares que la Story 9 original volvió legítimo se explica también en [usuarios.md](./usuarios.md#el-patch-de-pares-reemplaza-el-set-completo-no-mergea), desde el otro lado.

## El diff se guarda, no un snapshot

`{ campo: { antes, despues } }`, sólo lo que cambió. Un snapshot completo de la fila obligaría a comparar dos filas a mano para saber qué pasó.

Un campo puede venir también como `{ campo: { redactado: true } }` — sin `antes` ni `despues`. Es la MISMA estructura `diff`, no dos formatos que el consumidor tenga que distinguir de antemano: recorre un solo objeto y decide cómo pintar cada entrada según qué claves trae. Ver "Datos personales: qué se redacta" más abajo.

## Alcance: de dos entidades a seis

Arrancó (Story 9) cubriendo sólo `Vinculacion` y `VinculacionPuestoCentro` — lo único que en ese momento perdía información de verdad al editarse, porque el PATCH de pares hace hard-delete de la fila vieja (ver "El borrado físico de los pares..." más abajo). Se extendió a:

- **`Organizacion`** — la más simple, sirvió de smoke test del wiring nuevo (identidad del actor + `createdBy`/`updatedBy`, que hasta ahora ni se seteaban).
- **`ReglaAsignacion`** — el patrón más parecido a `Vinculacion` (activo/`deletedAt` como dos ejes independientes), calcado casi directo.
- **`Pregunta`** — `create()` y el toggle de papelera (`setActiva`), sin campos redactados: no tiene datos personales.
- **`Usuario`** — la sexta y la única con redacción: `nombre`/`apellido` viajan completos, `dni`/`email` redactados. Sin esto, la decisión sobre el DNI no auditaba nada, porque hasta ese momento `UsuariosService` sólo auditaba la `Vinculacion`, nunca la identidad de la persona.
- **`Modulo` y `ModuloVersion`** — las más enredadas, porque `ModuloVersion` mezcla columnas propias (estado, numeración) con contenido (preguntas, criterios) que no es una entidad auditada en sí misma. Ver la sección dedicada más abajo.

Lo que sigue sin auditar, a propósito: `Puesto`/`CentroCosto` (catálogos con trazabilidad básica y baja lógica, sin nada que hoy pierda información), `Asignacion` (nunca se borra, se revoca — el propio historial de revocaciones ya es la auditoría) y `Sesion`/`Respuesta` (inmutables, sin ningún camino de edición). Ninguna de esas pierde su historia mientras tanto — extenderles el log sigue siendo trabajo pendiente, no una urgencia.

Consecuencia sin arreglo posible, que sigue vigente: **lo anterior a la primera pasada de cada entidad no es recuperable.** El historial de cada una arranca el día que se instrumentó, no hay backfill — ni para las dos originales (Story 9) ni para las cuatro que se sumaron después.

## Identidad real del actor: dos columnas que conviven, no una que reemplaza a la otra

`actor` (el `String` libre original) **no cambió de significado**: sigue siendo el string de CANAL (`'backoffice'`, `'import'`, `'tablet'`) — de dónde entró el cambio, no quién lo hizo. Se sumaron cuatro columnas nuevas (`actorUsuarioId`, `actorNombre`, `actorApellido`, `actorRol`) recién cuando `@Actor()`/`RolesGuard` ya estaban disponibles para leer la identidad real desde el token. Las dos cosas coexisten a propósito: `actor` sigue diciendo "por dónde", las cuatro nuevas dicen "quién".

- **Migración sin backfill**: las cuatro son nullable y las filas de antes de esa migración quedan con `actor` en su string de siempre y las cuatro en `NULL` — no hay forma de reconstruir qué usuario hizo cada cambio viejo, así que no se inventa nada.
- **`actorUsuarioId` es un `Int` simple, sin FK a `Usuario`**: mismo motivo que `entidadId` no es FK a nada (ver más abajo) — `AuditLog` es polimórfica e inmutable, y una FK normal la ataría a que la fila del actor nunca se borre. El filtro del log global por actor va por esta columna y por `actorRol`, nunca por join.
- **`actorNombre`/`actorApellido` se congelan al momento del cambio**, igual que el resto del diff no se actualiza retroactivamente: si la persona cambia de nombre después, la fila vieja sigue diciendo el nombre de entonces.
- **El import de nómina también manda identidad real**: `POST /import/usuarios/confirm` está autenticado (detrás de `GESTION_NOMINA`) y ahora le pasa `@Actor()` a `UsuariosService.create()`, así que un alta por Excel deja de auditarse como `'import'` genérico en las columnas nuevas — el string de canal (`actor: 'import'`) sigue igual, lo que cambia es que además queda quién lo subió.
- **Callers sin `IdentidadResuelta`** (seeds, scripts, cualquier caller interno futuro sin token) simplemente no pasan `actorIdentidad`, y las cuatro columnas quedan `NULL` — mismo resultado que las filas viejas, sin caso especial en el código.

## Datos personales: qué se redacta, qué viaja completo, y qué no entra ni redactado

Sólo `Usuario` tiene datos personales en las columnas que audita. Se resolvió en tres niveles:

- **`dni`/`email`: redactados.** El diff dice que cambiaron (`{ redactado: true }`), nunca a qué — ni el valor viejo ni el nuevo. Consecuencia aceptada: si alguien corrige un DNI mal cargado, el log confirma que pasó pero no permite reconstruir cuál era el valor original.
- **`nombre`/`apellido`: completos.** Son necesarios para identificar a la persona en su propio historial de auditoría, y se consideraron menos sensibles que un documento o un email.
- **`authProviderId` (el `sub` de Auth0): ni siquiera entra al diff, redactado o no.** Es un identificador interno del proveedor, nadie lo edita a mano — `usuarioEscalar()` directamente no lo lee, así que no hay manera de que aparezca por accidente si alguien agrega un campo nuevo al lado sin querer.

La redacción vive en `calcularDiff()` como un tercer modo, no como una lista aparte de "campos a esconder": un campo en `camposRedactados` pasa por la MISMA regla de igualdad que cualquier otro (la que ya distinguía null de undefined y comparaba `Date` por instante) — si no cambió, o nunca tuvo valor (un alta sin email, por ejemplo), no genera ninguna entrada, ni siquiera `{ redactado: true }`: no hay nada que redactar si no hubo un cambio real. Sólo cuando SÍ cambió es que el valor se reemplaza por el marcador. Esto es lo que evita que, por ejemplo, cada alta de usuario genere ruido de "email cambió" cuando en realidad nunca se cargó ninguno.

Ningún otro campo de ninguna otra entidad se redacta: `Organizacion`, `ReglaAsignacion`, `Pregunta`, `Modulo` y `ModuloVersion` no tienen datos personales en las columnas que auditan.

## Una fila por ENTIDAD que cambia, no por fila de base tocada

Regla general aplicada en todo el trabajo de esta ronda: una sola acción de negocio puede escribir varias filas de `AuditLog`, pero sólo cuando de verdad cambia más de una entidad — nunca una fila por cada fila de una tabla-pivot que la acción tocó por dentro.

- **Dos entidades distintas → dos filas, cada una legítima.** Un alta de `Usuario` con vinculación genera un `CREATE` de `Usuario` y un `CREATE` de `Vinculacion` (más uno por cada par inicial): son tres entidades reales que nacieron en la misma transacción, no la misma entidad contada tres veces. Mismo caso con `activar()` de un módulo: si había un `ACTIVO` previo, se archivan una `ModuloVersion` y se publica otra — dos filas porque son dos `entidadId` distintos, no el mismo evento duplicado.
- **Una tabla-pivot no auditada que cambia por dentro de una entidad SÍ auditada → una sola fila.** `ModuloVersionPregunta` y `ModuloVersionCriterio` no son entidades auditadas (ver la sección de `Modulo`/`ModuloVersion` abajo). `PUT /:id/criterios` puede crear y borrar decenas de filas de `ModuloVersionPregunta` por dentro de `resolverCriterios()`, pero genera **una** fila de `AuditLog` sobre `ModuloVersion`, con el resumen agregado (`{ agregadas, quitadas }`) que el propio `resolverCriterios()` ya calculaba — no una entrada por pregunta movida. Mismo criterio en `asignarPreguntas()` (lista de ids agregados, una fila), `setPreguntaActiva()` y `unassignPregunta()` (una fila por llamado, con qué pregunta cambió adentro del diff). Un guardado idempotente (0 agregadas, 0 quitadas) no escribe nada.

Verificado en vivo contra la base: un criterio que matcheó 27 preguntas de una base real dejó **una** fila (`{"preguntas": {"antes": null, "despues": {"agregadas": 27, "quitadas": 0}}}`), no 27.

## `Modulo` y `ModuloVersion`: columnas propias vs. contenido

`ModuloVersion` es la entidad más enredada de las seis porque mezcla dos tipos de cambio, con dos helpers distintos del lado del service:

- **Columnas propias** (`estado`, `anio`/`mayor`/`menor`, `activadaEn`, `esNuevaLinea`, los cuatro parámetros de examen): se auditan con el mismo patrón que cualquier otra entidad — `calcularDiff()` sobre dos filas reales, `antes` y `despues`. Las dispara `crearVersion()` (CREATE), `activar()` (hasta dos UPDATE, uno por versión afectada), `setParametrosExamen()` (UPDATE) y `cancelarBorrador()` (DELETE real — `ModuloVersion` no tiene `deletedAt`, la fila se borra de verdad).
- **Contenido** (qué preguntas tiene, cuáles trajo un criterio): la entidad que cambia de verdad (`ModuloVersionPregunta`/`ModuloVersionCriterio`) no es una de las seis auditadas, así que el diff no sale de comparar dos filas — lo arma a mano cada caller (`asignarPreguntas`, `setPreguntaActiva`, `unassignPregunta`, `setCriterios`) y un segundo helper (`auditarContenidoModuloVersion`) sólo valida que no esté vacío y lo escribe. Es la aplicación directa de la regla de la sección anterior.

`Modulo` (el contenedor) se audita aparte y es más simple: `create()` (junto con el `CREATE` de su v1), `update()` de metadata, y el `DELETE` real que dispara `cancelarBorrador()` cuando el módulo nunca se publicó y cancelar el único borrador se lo lleva puesto — otro caso de fila real, no soft-delete (`Modulo` tampoco tiene `deletedAt`).

## `CREATE` con `antes: null` en un revive: por qué se ignora lo que había antes de la baja

Precedente original de `Vinculacion` (Story 9), generalizado en esta ronda a `ReglaAsignacion` y `Usuario`: cuando una fila soft-deleted vuelve a la vida (mismo DNI, mismo triple puesto+centro+módulo), el evento se audita como `CREATE` con `antes: null` — no como `UPDATE` contra los valores que la fila tenía antes de borrarse.

La razón es la misma en los tres casos: lo que se registra es un HECHO DE NEGOCIO ("esta persona/regla volvió a estar activa"), no un evento de base de datos ("se actualizó una fila que técnicamente ya existía"). Mostrar el valor previo mezclaría dos historias que no son la misma pregunta: quién es esta persona/regla HOY no depende de qué decía antes de haberse dado de baja.

`ReglaAsignacion.create()` distingue el caso con cuidado porque hay uno parecido que NO es esto: reactivar una regla VIVA-pero-pausada (`activo: false`, nunca se borró) sí es un `UPDATE` real, con el antes/despues real del flag — ahí no hay ningún revive, sólo se sacó la pausa.

## `DELETE`: antes/despues real, salvo cuando la fila ni se toca

Dos tratamientos distintos conviven, y la diferencia es si hay o no una escritura real:

- **Vinculacion.remove()** (el precedente original): `remove()` de `Usuario` sólo marca `deletedAt` en la fila de `Usuario` — la `Vinculacion` en sí NO se toca en la base. Se audita igual como una baja (`DELETE`, `despues: null`) porque en los hechos deja de aplicar, aunque la fila siga ahí.
- **`ReglaAsignacion.remove()`, `Usuario.remove()`, `cancelarBorrador()`** (`ModuloVersion`/`Modulo`): acá SÍ hay una escritura real (`deletedAt` que pasa de `null` a una fecha, o un `DELETE` físico), así que el diff muestra el antes/despues real de esa columna — más útil que forzarlo a `null` cuando la información está disponible sin costo.

La regla, en una línea: si la fila se toca de verdad, el diff lo muestra; si no se toca (como la `Vinculacion` en `Usuario.remove()`), se fuerza a `null` porque no hay ningún valor real que comparar.

## Hook explícito desde el service, dentro de la transacción del cambio

No un middleware de Prisma ni un interceptor de Nest: un middleware no sabe **quién** hizo el cambio ni distingue un cambio real de uno cosmético.

Y el `tx` es obligatorio en `registrar()` —sin default a `this.prisma` y sin ser opcional— justamente para que un rollback se lleve el log puesto: un `AuditLog` escrito fuera de la transacción quedaría describiendo un cambio que nunca se aplicó. Se mantuvo así al extender a las cinco entidades nuevas: cada una de ellas ahora abre (o ya abría) una `$transaction` alrededor de la escritura + el `registrar()`, incluidos dos services (`PreguntasService.create()`/`setActiva()`) que antes no necesitaban ninguna transacción y pasaron a necesitarla sólo por esto.

## El borrado físico de los pares se vuelve legítimo gracias a esta decisión, no a pesar de ella

La tabla responde *"qué pares tiene hoy"*; el log responde *"qué pares tuvo"*. Con soft-delete las dos preguntas vivirían mezcladas en la misma tabla y encima seguiría sin haber fecha ni actor.

Consecuencia: **el log es infraestructura crítica, no un adicional** — por eso `AuditLog` es inmutable y no tiene soft-delete. Borrarlo, aunque fuera lógicamente, le pega al propósito de la tabla.

## `listarPorUsuario()` no consulta la tabla de pares ni filtra por `deletedAt`

Por el mismo motivo que la sección anterior: el log es la única fuente de ese historial, no un espejo de lo que hay hoy en la tabla.

- **Los pares se resuelven por PREFIJO de `entidadId`**, nunca leyendo `VinculacionPuestoCentro`: un par que se sacó no tiene fila que leer, pero su `CREATE` y su `DELETE` siguen en el log, y es precisamente el historial que interesa mostrar.
- **No se filtra por `deletedAt`**, a diferencia del resto de la API: el 404 acá significa "esta persona nunca existió", no "está dada de baja", porque el caso de uso central es ver el historial de alguien que ya no está.

Sin paginar, a propósito: el volumen por persona es de decenas de filas, no cientos.

## `entidadId` no es FK a nada: la tabla es polimórfica a propósito

`AuditLog` guarda cambios de seis entidades (`Vinculacion`, `VinculacionPuestoCentro`, `Organizacion`, `ReglaAsignacion`, `Pregunta`, `Usuario`, `Modulo`, `ModuloVersion` — sí, son ocho nombres distintos de `entidad` para las seis "familias" auditadas, contando los pares y las dos mitades de módulo por separado) en una sola tabla, así que usa `entidad` + `entidadId` (`String`) en vez de una relación tipada: no hay "la entidad que corresponda" a la que apuntar con una FK. `entidadId` guarda el id real de cada una tal cual es — `String` (uuid) para `Pregunta`/`Modulo`/`ModuloVersion`/`ReglaAsignacion`, y el entero de `Usuario`/`Organizacion`/`Vinculacion` convertido a string.

La contra, explícita: la base **no garantiza** que un `entidadId` apunte a algo que existe hoy — y de hecho, para un par eliminado o una `ModuloVersion` borrada por `cancelarBorrador()`, apunta a propósito a una fila que ya no está. Es la contracara de que el log sea la única fuente de ese historial: no puede validar contra algo cuya desaparición es justamente lo que está registrando.

## El log GLOBAL (`GET /audit-log`): por qué ADMINISTRADOR + AUDITOR, y no COORDINADOR

Nuevo conjunto en `matriz-permisos.ts`, `AUDITORIA`, distinto de los tres que ya existían (`LECTURA_BACKOFFICE`, `GESTION_NOMINA`, `SOLO_ADMINISTRADOR`) porque ninguno tenía el corte exacto: `COORDINADOR` administra la nómina día a día, pero certificar ISO 9001 —para qué existe este log— no es su trabajo. `AUDITOR` sí entra: es justamente el rol pensado para mirar esto desde afuera (ver el modelo de roles en `CLAUDE.md`).

`AuditController` (`audit/audit.controller.ts`) es un controller aparte del que sirve `GET /usuarios/:id/audit-log` — ese sigue colgando de `UsuariosController` porque es el historial de UNA persona, con `LECTURA_BACKOFFICE` (incluye `COORDINADOR`, que sí necesita ver los cambios de su propia gente).

Dos diferencias con `listarPorUsuario()`:

- **Pagina.** El volumen por persona es acotado (decenas de filas); el log global no tiene ese límite natural — puede crecer a miles. `FindAuditLogDto` acepta `entidad?`, `actorRol?`, `actorUsuarioId?`, `desde?`, `hasta?`, `page?`, `limit?`, todos opcionales y combinables con AND.
- **Devuelve ids crudos, sin resolver nombres.** `puestoId`/`moduloId`/etc. viajan tal cual están en el diff, sin join a los catálogos — mismo criterio que ya usa `HistorialUsuario.jsx` hoy: la pantalla que lo consuma ya va a tener los catálogos cargados para traducirlos, y resolverlos del lado del backend duplicaría esa responsabilidad sin necesidad.

## Costo asumido

- `UsuariosService.update()` lee el estado previo de `Vinculacion` Y de `Usuario` dentro de la transacción, y la rama "alta sin pares" —el camino del import de nómina— abre una transacción por fila.
- Extender a las cinco entidades nuevas significó envolver en `$transaction` varios métodos que antes no la necesitaban (`OrganizacionesService.create()`/`update()`, `PreguntasService.create()`/`setActiva()`, y casi todo `ModulosService`), cada uno con al menos una lectura extra del "antes" — en varios casos reusando una fila que el método ya tenía que leer igual por otro motivo (`ReglaAsignacion.update()`, `ModulosService.setParametrosExamen()`), pero no siempre.
- El log global no resuelve nombres ni pagina con cursor — `skip`/`take` clásico. A este volumen (cientos de filas totales hoy) no hace falta más; si el log crece mucho, `skip` se vuelve costoso antes que el resto de la app.
