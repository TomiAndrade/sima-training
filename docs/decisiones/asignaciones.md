# Decisiones — Asignaciones, reglas, vigencia y veredicto

Cubre `ReglaAsignacion` (qué módulo es obligatorio para qué par o centro), `Asignacion` (la obligación concreta de una persona), el motor `recalcular()`, la vigencia de las aprobaciones (`vigencia.ts`), el veredicto de habilitación (`veredicto.ts`), y las tres pantallas del backoffice que los muestran — Reglas, Asignaciones e Historial de una persona.

**No cubre**: de dónde salen los pares puesto+centro que alimentan el motor ([usuarios.md](./usuarios.md)) ni cómo se registra que alguien aprobó ([sesiones.md](./sesiones.md)). Acá está el **consumo** de esas aprobaciones, no su escritura.

---

## Reglas y asignaciones

### `ReglaAsignacion` tiene dos alcances que conviven

- **Con `puestoId`**: regla por **par exacto** (puesto, centro de costo) — "Soldador en YPF" puede pedir módulos distintos que "Soldador en PAE". Mismo criterio que `VinculacionPuestoCentro`: el par, no cada eje por separado.
- **Con `puestoId` en `null`**: regla de **centro de costo**, que aplica a todos los puestos de ese centro (la rinde cualquiera con algún par activo ahí).

Un soldador de Taller alcanzado por las dos recibe los dos módulos: `recalcular()` los unifica en un único `Set` y nunca duplica la `Asignacion`.

Apunta a `Modulo` (el contenedor), **no** a una `ModuloVersion`: la obligación es "este módulo", y la versión concreta se resuelve al momento de rendir.

### La unicidad vive en DOS índices parciales, y la tabla no declara ningún `@@unique`

Los dos existen sólo en el SQL de la migración `20260729171533_reglas_asignacion_soft_delete`. Prisma no expresa `WHERE` en `@@unique`, así que el `@@unique([puestoId, centroCostoId, moduloId])` que generaba se **dropeó ahí mismo**: no distinguía filas vivas de eliminadas, y una regla eliminada seguía bloqueando la creación de otra con el mismo triple.

| Índice | Columnas | Predicado |
|---|---|---|
| `reglas_asignacion_par_modulo_vivas` | `(puesto_id, centro_costo_id, modulo_id)` | `deleted_at IS NULL` |
| `reglas_asignacion_centro_modulo_sin_puesto` | `(centro_costo_id, modulo_id)` | `puesto_id IS NULL AND deleted_at IS NULL` |

Los dos predicados son **ortogonales**: `puesto_id` elige qué **alcance** gobierna el índice, `deleted_at` elige qué **filas** están vivas — por eso se combinan en vez de unificarse. El primero cubre exactamente las reglas **con** puesto (con `puesto_id` NULL, Postgres considera cada fila distinta de las demás, así que las de centro se le escapan) y el segundo tapa esa mitad.

Tienen que ser parciales por partida doble: un UNIQUE común sobre (centro, módulo) impediría que la regla de centro y las de par del mismo centro+módulo coexistan, y uno sin `WHERE deleted_at` haría que "volver a agregar" una regla eliminada **choque** en vez de revivirla.

Corolario en el service: `create()` busca con `findFirst` y `puestoId: dto.puestoId ?? null`, no con `findUnique` (que no puede consultar por NULL). El `?? null` es load-bearing — con `undefined`, Prisma dropea la condición y terminaría reactivando cualquier regla de ese centro+módulo. Y busca **primero la viva y sólo después la eliminada**: como los índices sólo prohíben dos *vivas*, una viva y una eliminada del mismo triple pueden coexistir, y una búsqueda sin ordenar podía revivir la eliminada y chocar contra la viva.

### `Asignacion` nunca se borra, se revoca

`revocadaAt`. Un índice único parcial (`WHERE revocada_at IS NULL`) garantiza a lo sumo una vigente por (usuario, módulo) — vive también sólo en la migración SQL, mismo caso que los dos de arriba y que el `principal` de `VinculacionPuestoCentro`.

### Eliminar una regla es baja lógica, y convive con `activo` a propósito

La duda razonable es por qué hay dos ejes de baja habiendo ya `activo`:

- **`activo`** es la **pausa reversible**: la regla sigue en el listado del backoffice y se reactiva con un click.
- **`deletedAt`** es sacarla de la vista para siempre, que es lo que hace falta cuando una regla se cargó por error o el par dejó de existir — dejarla desactivada para siempre ensucia el acordeón.

Ahora bien, **la fila nunca se borra**: `remove()` setea `deletedAt` y nada más. Es la única evidencia de por qué una persona tuvo que rendir un módulo, y no puede desaparecer mientras el vínculo asignación→regla no se persista (hoy el "por qué" se recalcula en el cliente, ver más abajo). O sea que la convención del dominio —nada se borra físicamente: `Asignacion` revoca, `Pregunta` va a papelera, los catálogos usan `activo`— **se respeta**; lo irrecuperable es sólo el acceso desde el backoffice, que no lista las eliminadas ni tiene filtro para verlas.

Recrear el mismo triple **revive esa misma fila** (mismo `id`, misma trazabilidad), así que "eliminé sin querer" se resuelve volviéndola a cargar.

---

## El motor `recalcular()`

### Síncrono, idempotente, y nunca toca las MANUAL

Los pasos:

1. Trae los pares **ACTIVOS** de la vinculación.
2. Arma la unión de módulos requeridos: las reglas vigentes que matchean algún par exacto **más** las de centro de los centros donde tiene algún par activo. Un módulo pedido por dos reglas aparece una sola vez — es un `Set`, así que genera **una sola** asignación.
3. Resta los módulos ya aprobados y los ya cubiertos por cualquier vigente (de cualquier origen: no se duplica sobre una MANUAL).
4. Crea las `AUTOMATICA` que faltan.
5. Revoca las `AUTOMATICA` vigentes cuyo módulo ya no está en `requeridos`.

El paso 5 usa `requeridos` **sin restarle los aprobados**, a propósito: un módulo aprobado que una regla sigue pidiendo no se revoca, sólo no se re-crea.

Correrlo dos veces seguidas no duplica ni revoca de más. Las `MANUAL` —las que carga un admin a mano— no las toca nunca.

### Se auto-invoca desde el ABM de usuarios, con guards asimétricos

Dentro de la **misma transacción** que cambió los pares, para que el recálculo vea los pares nuevos y, si algo falla, se revierta todo junto. `POST /asignaciones/recalcular/:usuarioId` se mantiene para recalcular a demanda.

Los guards son asimétricos a propósito:

- **`create()`, rama normal**: recalcula **sólo si el alta trae pares**. Sin pares no hay nada que derivar (requeridos = ∅, vigentes = ∅), así que es un `create` plano — es el camino del import de nómina.
- **`create()`, rama revive** (alta sobre un DNI dado de baja): recalcula **siempre, sin guard**. Un usuario revivido puede arrastrar `AUTOMATICA` vigentes de antes de la baja, así que aunque reviva sin pares hay que revocar las que ya no correspondan.
- **`update()`**: recalcula **sólo si el request tocó `pares`**. Cambiar nombre / rol / organización no lo dispara; mandar `pares: []` (vaciar) **sí**, para revocar las que sobran.
- **`remove()`**: **no recalcula nada** — sólo setea `deletedAt` y deja las asignaciones vigentes tal cual. Es exactamente el motivo por el que la rama de revivir no lleva guard.

### Tocar una REGLA también recalcula, en la misma transacción

Cierra la asimetría que había con el ABM de usuarios. `ReglasAsignacionService` inyecta `AsignacionesService`, y las tres mutaciones (`create` / `update` / `remove`) llaman a `recalcularCentro()` dentro de la transacción que cambió la regla: si algo falla se revierte todo junto y no quedan asignaciones derivadas de una regla que no se llegó a guardar.

Por eso las tres devuelven `{ regla, recalculo: { usuarios, creadas, revocadas } }` y no la regla pelada — **la consecuencia real no se ve en el listado de reglas**, lo que cambia son las asignaciones de otra gente.

- **El fan-out es acotado y no hace falta un job en background**: a quien alcanza una regla —de par exacto o de centro— es siempre alguien con un par **activo** en ese centro de costo, así que el centro alcanza como filtro para los dos alcances (`usuariosAlcanzados`). Se excluyen los usuarios dados de baja, porque `recalcularEnTx` los rechaza con un 404 que abortaría la transacción entera.
- El timeout de la transacción se sube a 15 s (`TX_TIMEOUT_MS`; el default de Prisma son 5) porque adentro corre **un recálculo por persona**, no una sola query.

### ⚠️ Lo que sigue SIN recalcular: dar de baja un `Puesto` o un `CentroCosto`

`recalcularEnTx` mira `VinculacionPuestoCentro.activo` y `ReglaAsignacion.activo`/`deletedAt`, **nunca** `Puesto.activo` ni `CentroCosto.activo`, y ni `PuestosService` ni `CentrosCostoService` inyectan el motor.

O sea: los pares y las reglas que apuntan a un puesto dado de baja siguen vivos y siguen generando obligaciones — y **`POST /asignaciones/recalcular/:usuarioId` tampoco lo corrige**, porque el motor ignora ese flag. Verificado contra la API.

Puede ser el comportamiento correcto (el `activo` de los catálogos significa "no ofrecerlo más en los selects", no "invalidar lo ya cargado"), pero **está sin decidir explícitamente** — ver [`../pendientes.md`](../pendientes.md), que tiene el planteo completo y lo que costaría cambiarlo.

### `modulosAprobados()`: qué módulos están cubiertos HOY

Ya no significa "aprobó alguna vez" sino **"aprobó y esa aprobación todavía vale"** (ver la vigencia, abajo). Consulta las `Sesion` con `aprobada: true` y sale por `moduloVersion.moduloId`: aprobar **cualquier** versión cubre el módulo, así que una recontratación no obliga a rendir de nuevo lo ya aprobado.

Es una foto del momento en que se llama, no el historial: para *"¿aprobó este módulo alguna vez, aunque hoy esté vencido?"* hace falta otra consulta.

**Lee por el cliente transaccional**, no por `this.prisma`. Fue un bug latente: el call site pasaba `usuarioId` a secas y el método usaba `this.prisma`; daba igual mientras devolviera un `Set` vacío, pero apenas consultó de verdad, el recálculo embebido en el ABM de usuarios o de reglas habría leído una foto de **afuera de su propia transacción**.

---

## Vigencia de las aprobaciones

Hace que `Modulo.vigenciaMeses` gobierne de verdad: antes se persistía, viajaba en los DTO y se mostraba en el backoffice, pero ninguna regla de negocio lo consumía.

### El vencimiento es DERIVADO, no un evento

No hay job programado ni columna `vencidaAt`: `calcularVencimiento()` (`vigencia.ts`) se corre **al leer**, contra `Sesion.createdAt` de la última aprobación y `Modulo.vigenciaMeses` vivo.

Funciona sin infraestructura nueva porque **aprobar no revoca la `Asignacion`**: cuando una aprobación caduca no hay ninguna fila que crear ni que tocar — la asignación ya estaba ahí, y lo único que cambia es la respuesta a "¿está cumplido?" la próxima vez que alguien pregunta.

### La fecha es `Sesion.createdAt` de la aprobación MÁS RECIENTE

`aprobacionesPorModulo()` agrupa en JS por `moduloId` quedándose con el `createdAt` más alto: volver a rendir y aprobar de nuevo **reinicia el reloj** de la vigencia, no lo conserva desde la primera vez.

`createdAt` (reloj del servidor) y no `finalizadaEn` (reloj del dispositivo) por el mismo motivo que rige en toda `Sesion` — ver [sesiones.md](./sesiones.md#iniciadaenfinalizadaen-son-el-reloj-del-dispositivo-el-autoritativo-es-createdat).

### `vigenciaMeses` se lee VIVO de `Modulo`, no se congela en la `Sesion`

A diferencia de `umbralAprobacion`, que **sí** se congela ([sesiones.md](./sesiones.md#el-umbral-se-congela-en-la-fila)). Son decisiones opuestas a propósito, porque deciden cosas distintas:

- El **umbral** decide un **veredicto ya emitido**: cambiarlo reescribiría certificados entregados.
- La **vigencia** decide **cuándo vuelve a existir una obligación futura**.

Si HSE acorta la vigencia de un módulo por un cambio de norma, la lectura vigente es que quiere que le venza antes a **todo el mundo**, no sólo a quien apruebe de ahora en más. No está confirmada con HSE: si la respuesta fuera la otra (respetar el plazo con el que se aprobó), hace falta congelar la vigencia por sesión + backfill — ver la pregunta abierta en [`../pendientes.md`](../pendientes.md).

### `vigenciaMeses` null (o `0`) = no vence nunca

Es el default de todos los módulos cargados hoy, así que esto no le cambia el comportamiento a nadie hasta que se empiecen a cargar vigencias reales.

### `recalcular()` no necesitó tocar el paso de revocación

El paso de **creación** se beneficia solo: una aprobación vencida deja de aparecer en `modulosAprobados()`, así que deja de tapar la creación de la `Asignacion`, sin ninguna línea de código nueva ahí. El de revocación sigue comparando contra `requeridos` sin restarle los aprobados, sin cambios.

Consecuencia que sí hay que tener presente: **`recalcular()` deja de ser determinista respecto de la base sola.** La misma base, consultada en dos fechas distintas, puede devolver un resultado distinto (una aprobación que hoy cubre puede vencer mañana sin que nada más haya cambiado). Sigue siendo idempotente en el sentido que importa: correrlo dos veces seguidas **en la misma fecha** no duplica ni revoca de más.

---

## Veredicto de habilitación

La respuesta a *"¿esta persona puede entrar a planta?"*, agregando el vencimiento de todas sus asignaciones en un solo estado. Vive en `veredicto.ts` como función pura.

### El veredicto lo calcula el BACKEND, no el frontend

*"Esta persona está habilitada"* es una regla de seguridad laboral, no una decisión de presentación: si vive en el cliente, el día que haga falta desde otro lado —un PDF, un reporte, la tablet— se reimplementa.

No es hipotético: ya hay un precedente anotado como deuda, la columna "Por qué" de la pantalla de Asignaciones (ver más abajo), con el costo conocido de que si cambia el backend hay que tocar los dos lados.

### Es una jerarquía de GRAVEDAD, no de conteo

Una sola asignación `VENCIDO` pesa más que diez `SIN_APROBAR`. No se cuentan casos ni se promedian estados: se busca la **peor situación** entre las asignaciones no revocadas y esa sola decide.

El orden es `NO_HABILITADO` (alguna VENCIDO) > `PENDIENTE` (alguna SIN_APROBAR) > `POR_VENCER` (alguna POR_VENCER) > `EN_REGLA` (todas VIGENTE), y la primera que matchea gana.

Con **varias en el mismo estado disparador**, el veredicto apunta a la **primera del array**: no hay criterio de "peor" entre dos vencidas, así que no se inventa un desempate. Es decisión explícita y no una limitación — hay un spec que la fija.

### `SIN_OBLIGACIONES` es distinto de `EN_REGLA`

No tener nada que cumplir no es lo mismo que estar al día. Son dos respuestas distintas a "¿puede entrar a planta?", y colapsarlas escondería a alguien **sin ninguna capacitación asignada** detrás de un verde.

### Las revocadas no cuentan para el veredicto, pero se muestran

Una asignación revocada ya no le corresponde a la persona, aunque haya estado vencida antes de revocarse: se filtran **primero**, antes de aplicar la jerarquía.

Pero sí se muestran en la pantalla, aparte y colapsadas — no compiten con las vigentes, y el historial importa para ISO 9001.

### Un endpoint AGREGADOR, no tres requests orquestados en el cliente

`GET /usuarios/:id/informe` devuelve usuario + veredicto + asignaciones + sesiones + auditoría en un solo request.

Es un endpoint hecho a medida de una pantalla, algo que **en general conviene evitar** porque ata la API al layout. Se acepta acá porque el **informe de usuario es una entidad de producto** —lo pidieron con ese nombre— y no una conveniencia de render: la pregunta "¿cuál es el estado de esta persona?" existe en el dominio independientemente de qué pantalla la haga. **No es precedente para agregar un endpoint por pantalla.**

### `findOne()` corre SECUENCIAL antes del `Promise.all`

Con las cuatro fuentes en paralelo, un id inexistente dispara las otras tres queries al pedo y —lo que importa— hace competir **dos** `NotFoundException` con mensajes distintos: el de `AuditService.listarPorUsuario()` **no filtra `deletedAt`**, a propósito ([auditoria.md](./auditoria.md#listarporusuario-no-consulta-la-tabla-de-pares-ni-filtra-por-deletedat)). El 404 que ganaba dependía de cuál promesa rechazaba primero.

Un round trip de más a cambio de un 404 determinista. Está comentado en el código para que no se "optimice" volviéndolo a meter adentro.

---

## Frontend

### Las dos pantallas, y por qué la de Asignaciones es de consulta

`ReglasAsignacion.jsx` es el ABM de las reglas; `TrainingAssignments.jsx` reemplazó al mock viejo de HSE y **cambió de sentido: es de consulta, no de acción**, porque las asignaciones las deriva el motor y no se cargan a mano. Lo que aporta la pantalla es *"¿qué le corresponde a esta persona y por qué?"*.

Es **por persona y no una tabla global** por un límite duro de la API: `GET /asignaciones` **exige** `?usuarioId=` y no existe endpoint que liste las de todo el mundo — construirla iterando sobre todos los usuarios serían N requests.

### La explicabilidad de una asignación se deriva en el cliente

Ningún endpoint devuelve **por qué** existe una `Asignacion`, así que la columna "Por qué" reimplementa en el frontend el mismo matching que `recalcularEnTx`: trae las reglas activas y para cada `AUTOMATICA` busca una del mismo módulo que matchee el par exacto, o una de centro con `puestoId === null`.

Se aceptó la duplicación en vez de agregar un campo `motivo` a `Asignacion` —que habría que mantener consistente en cada recálculo— o un endpoint de explicación; el costo es que **si el matching del backend cambia, hay que tocar los dos lados**. Está anotado en [`../pendientes.md`](../pendientes.md).

Cuando no encuentra ninguna regla que la justifique muestra **"Regla desconocida"** en ámbar, en vez de inventar una explicación. Ese caso se volvió raro desde que tocar una regla recalcula en el acto: lo que queda son residuos —asignaciones derivadas antes de que el recálculo fuera automático, o datos cambiados por fuera de la app— y el hecho de que la pantalla trae las reglas **una sola vez al montar**, así que si otra sesión edita una regla mientras tanto, acá se ven viejas. Sigue siendo la señal que justifica apretar "Recalcular".

### La vista de historial: early return y `core/format/`

La hoja de vida de una persona (`HistorialUsuario.jsx`) se muestra **en lugar** de la lista, con un early return dentro de `Usuarios.jsx`, no como página propia de `App.jsx`. Es lo que hace que volver conserve la tab, la búsqueda y los usuarios ya cargados: el componente **nunca se desmonta**, así que sus `useState` siguen vivos y no hace falta levantar el estado a ningún lado. Moverla a `App.jsx` sí lo desmontaría — está comentado en el código.

De esa vista salió `core/format/` como lugar de los helpers compartidos entre capas: `formatVersionNumero` vivía en `sima-check/components/bancoModulo.jsx` y la vista nueva no lo alcanzaba, porque **`core/` no puede importar de `sima-check/`**. Se movió sin dejar re-export puente —un puente entre capas que sobrevive es el que después nadie se anima a borrar— y de paso se llevó `roleBadge`/`origenBadge`, que estaban copiados entre dos pantallas e iban camino a una tercera copia.
