# Decisiones — Auditoría

Cubre `AuditLog`: qué se audita y qué no, por qué se guarda un diff y no un snapshot, por qué la tabla es polimórfica, y cómo se lee el historial de una persona.

**No cubre**: qué se hace hoy con esa información en la pantalla — el render del diff es parte de la hoja de vida ([asignaciones.md](./asignaciones.md#la-vista-de-historial-early-return-y-coreformat)). El borrado físico de los pares que esta decisión vuelve legítimo se explica también en [usuarios.md](./usuarios.md#el-patch-de-pares-reemplaza-el-set-completo-no-mergea), desde el otro lado.

## El diff se guarda, no un snapshot

`{ campo: { antes, despues } }`, sólo lo que cambió. Un snapshot completo de la fila obligaría a comparar dos filas a mano para saber qué pasó.

## `actor` es un string genérico, no una FK a una cuenta

Es el mismo vocabulario que ya usa `createdBy` (`'backoffice'` / `'import'` / `'tablet'`), porque no existen cuentas de usuario del sistema todavía.

Lo irrecuperable es el diff, no el actor: **quién** se puede completar después, cuando existan cuentas reales; **qué cambió** hoy, no. La columna es un `String` libre y acepta un id más adelante sin migrar nada.

## Alcance: sólo `Vinculacion` y `VinculacionPuestoCentro`

Es lo único que hoy realmente perdía información al editarse: el PATCH de pares hace hard-delete de la fila vieja (ver la sección de abajo). El resto de las entidades queda sin auditar **a propósito, por ahora** — ninguna pierde su historia mientras tanto, porque usan soft-delete, revocación o son inmutables. El detalle de cuáles y por qué, más el trabajo de extender el log, está en [`../pendientes.md`](../pendientes.md).

Consecuencia sin arreglo posible: **lo anterior a esta primera pasada no es recuperable.** El historial arranca acá, no hay backfill.

## Hook explícito desde el service, dentro de la transacción del cambio

No un middleware de Prisma ni un interceptor de Nest: un middleware no sabe **quién** hizo el cambio ni distingue un cambio real de uno cosmético.

Y el `tx` es obligatorio en `registrar()` —sin default a `this.prisma` y sin ser opcional— justamente para que un rollback se lleve el log puesto: un `AuditLog` escrito fuera de la transacción quedaría describiendo un cambio que nunca se aplicó.

## El borrado físico de los pares se vuelve legítimo gracias a esta decisión, no a pesar de ella

La tabla responde *"qué pares tiene hoy"*; el log responde *"qué pares tuvo"*. Con soft-delete las dos preguntas vivirían mezcladas en la misma tabla y encima seguiría sin haber fecha ni actor.

Consecuencia: **el log es infraestructura crítica, no un adicional** — por eso `AuditLog` es inmutable y no tiene soft-delete. Borrarlo, aunque fuera lógicamente, le pega al propósito de la tabla.

## `listarPorUsuario()` no consulta la tabla de pares ni filtra por `deletedAt`

Por el mismo motivo que la sección anterior: el log es la única fuente de ese historial, no un espejo de lo que hay hoy en la tabla.

- **Los pares se resuelven por PREFIJO de `entidadId`**, nunca leyendo `VinculacionPuestoCentro`: un par que se sacó no tiene fila que leer, pero su `CREATE` y su `DELETE` siguen en el log, y es precisamente el historial que interesa mostrar.
- **No se filtra por `deletedAt`**, a diferencia del resto de la API: el 404 acá significa "esta persona nunca existió", no "está dada de baja", porque el caso de uso central es ver el historial de alguien que ya no está.

## `entidadId` no es FK a nada: la tabla es polimórfica a propósito

`AuditLog` guarda cambios de varias entidades (`Vinculacion`, `VinculacionPuestoCentro`, lo que se sume después) en una sola tabla, así que usa `entidad` + `entidadId` (`String`) en vez de una relación tipada: no hay "la entidad que corresponda" a la que apuntar con una FK.

La contra, explícita: la base **no garantiza** que un `entidadId` apunte a algo que existe hoy — y de hecho, para un par eliminado, apunta a propósito a una fila que ya no está en `VinculacionPuestoCentro`. Es la contracara de que el log sea la única fuente de ese historial: no puede validar contra algo cuya desaparición es justamente lo que está registrando.

## Costo asumido

`update()` lee el estado previo antes de escribir, y la rama "alta sin pares" —el camino del import de nómina— abre una transacción por fila.
