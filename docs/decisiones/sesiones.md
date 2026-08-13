# Decisiones — Rendición de evaluaciones

Cubre `Sesion` (un intento de rendición) y `Respuesta` (una por pregunta contestada): qué se guarda, cómo se corrige, por qué el umbral se congela, la idempotencia de un reenvío y qué pasa con la asignación al aprobar.

**No cubre**: los endpoints HTTP por los que la tablet manda una rendición ([tablet.md](./tablet.md)) — `sesiones/` no tiene controller propio. Tampoco qué se hace después con esas aprobaciones para decidir si alguien está al día ([asignaciones.md](./asignaciones.md)).

Es la entidad que le faltaba al modelo durante varios sprints: el backend sabía **qué le corresponde rendir** a cada persona pero no registraba que lo hubiera rendido, y eso bloqueaba las aprobaciones, la vigencia, el informe de usuario y las estadísticas por base.

## Se guardan las respuestas INDIVIDUALES, no sólo el score agregado

Es lo que permite saber **en qué pregunta** se falla —para corregir preguntas malas— y derivar las estadísticas por base de conocimiento. Barato ahora, imposible retroactivamente.

## La corrección se PERSISTE, no se recalcula

`Respuesta.correcta` y `Sesion.aprobada` se guardan. Guardar sólo la respuesta dada y compararla después contra `Pregunta.respuestaCorrecta` haría que un cambio en el banco **reescriba el pasado** — mismo criterio que las versiones `ARCHIVADO` inmutables y que la imagen de una pregunta, que no se reemplaza.

Hoy `Pregunta` no tiene endpoint de edición, así que es defensa en profundidad más que una necesidad inmediata.

## El umbral se congela en la fila

`umbralAprobacion` se persiste por sesión. Sale de `ModuloVersion.umbralAprobacion` —el umbral con el que se publicó ese examen— y cae a `UMBRAL_APROBACION_DEFAULT = 70` (`sesiones/corregir.ts`) cuando la versión no declara ninguno. No se vuelve a leer al mostrar un resultado viejo: subirlo a 80 mañana **no puede reescribir lo que decían los certificados ya emitidos**. La columna venía preparada para esto y el cambio no necesitó migrarla.

Se lee de la **versión rendida** y no del módulo ni de la versión ACTIVO de hoy: una sesión sincronizada tarde (modo offline) contra una versión ya archivada se corrige con la regla que tenía cuando se rindió, no con la vigente. `corregir.ts` no cambió una línea — `calcularResultado(correcciones, umbral)` ya recibía el umbral por parámetro.

Es la decisión **opuesta** a la de `vigenciaMeses`, que se lee viva, y las dos son a propósito: ver [asignaciones.md](./asignaciones.md#vigenciameses-se-lee-vivo-de-modulo-no-se-congela-en-la-sesion).

## El `porcentaje` se persiste aunque sea derivable

De `correctas`/`total` saldría solo, pero el redondeo puede voltear el resultado en el borde (139/200 → 70 % aprueba; 1387/2000 → 69 % no): la fila tiene que decir **con qué número se decidió**, no obligar a reconstruirlo.

## El backend es la única autoridad sobre el resultado

`RegistrarSesionDto` recibe **sólo respuestas crudas** (`preguntaId` + `respuestaDada`). `correctas` / `total` / `porcentaje` / `aprobada` / el umbral **no existen en el DTO**, y la `ValidationPipe` global de `main.ts` (`whitelist` + `forbidNonWhitelisted`) los rechaza con **400**, no en silencio.

Sin esto, cualquiera con `curl` se aprueba todos los módulos, y es una certificación de seguridad laboral.

La app **no corrige local**: muestra el resultado que devuelve este endpoint, porque el contrato de la tablet nunca le manda `respuestaCorrecta` ([tablet.md](./tablet.md#namespace-y-contrato-propios-no-un-controller-dentro-de-sesiones)). Es lo que hace que el backend sea la única fuente del veredicto, y también lo que deja abierta una pregunta para el modo offline: sin conexión no hay con qué mostrar un score (ver [`../pendientes.md`](../pendientes.md)).

Para que la garantía alcance a los items de `respuestas[]` hacen falta `@ValidateNested({ each: true })` + `@Type()` — **verificado que son load-bearing**: sin ellos la pipe no entra al array y un item cuela campos de más.

## Un reintento es una fila más: NO hay unicidad sobre (usuario, versión)

Es la diferencia con `Asignacion`, donde el índice parcial deja a lo sumo una vigente. Acá las dos preguntas que importan son derivadas y no necesitan ningún flag `vigente` que mantener consistente:

- *"¿Aprobó?"* es `EXISTS(aprobada)` sobre **cualquier** versión del módulo — la obligación es "este módulo".
- *"¿Cuál fue el último intento?"* se ordena por `finalizadaEn`.

Un intento fallido **no des-aprueba**: volver a rendir y desaprobar no invalida la aprobación anterior. Lo único que la caduca es el tiempo, y eso lo decide la vigencia ([asignaciones.md](./asignaciones.md#vigencia-de-las-aprobaciones)).

Que un reintento sea una fila más sigue siendo cierto **con el tope de intentos**: el tope no cambió el modelo, se calcula contando esas filas (`ModuloVersion.maxIntentos`, ver [modulos.md](./modulos.md)). Y no se aplica acá: `crearSesion()` no rechaza una rendición por tope ni por espera — eso vive en `TabletService.examen()`, al servir el examen. Registrar lo que ya se rindió no se rechaza nunca, misma doctrina que el `ARCHIVADO` aceptado dos párrafos más arriba.

## `Sesion` es inmutable y no lleva soft-delete

Borrar —aunque sea lógicamente— una rendición cambia en silencio el historial de aprobación de alguien, y nada en el dominio la borra. Sin `updatedAt` / `updatedBy` por lo mismo (mismo tratamiento que `ModuloVersion`).

Si algún día aparece la necesidad de **anular** un intento (sospecha de copia), va como `anuladaAt` al estilo de `Asignacion.revocadaAt`, con `modulosAprobados()` filtrándolo — **no** como `deletedAt`.

## `iniciadaEn`/`finalizadaEn` son el reloj del DISPOSITIVO; el autoritativo es `createdAt`

Los manda la tablet. Con el modo offline el POST llega horas después y el reloj del dispositivo puede estar desfasado o mentido.

Sirven para medir cuánto duró la evaluación y ordenar los intentos de una misma tanda, pero la fecha oficial de la rendición a efectos de trazabilidad ISO —y la que gobierna la vigencia— es la del **servidor**. Está escrito en el schema y en la cabecera de la migración, no sólo acá.

## `ARCHIVADO` se acepta, `BORRADOR` no — y no se exige que la pregunta siga activa

Una sesión sincronizada tarde puede corresponder a una versión que se archivó mientras tanto, y **lo que se rindió, se rindió**. Un borrador, en cambio, es trabajo sin publicar: rendirlo sería certificar contra algo que nadie aprobó todavía.

Por el mismo motivo no se exige que la pregunta siga `activa`: una baja posterior no puede invalidar lo ya rendido. Hay un spec que fija que el `where` **no** filtra por `activa`, para que no se "arregle" agregándolo. Es una asimetría intencional con el examen que sirve la tablet, que sí filtra activas ([tablet.md](./tablet.md#el-examen-sirve-sólo-preguntas-activas-asimetría-intencional-con-registrar)).

## Una pregunta sin `respuestaCorrecta` se rechaza con 400

En vez de contarse como incorrecta: puntuar 0 en silencio le baja el score a alguien por un **dato faltante nuestro**.

Hoy sólo podría pasar con `TEXTO_LIBRE`, que está en el enum y no lo usa ningún módulo; la corrección manual necesitaría `Respuesta.correcta` nullable y un corrector.

## `Asignacion.moduloVersionId` se completa SÓLO al aprobar

Con eso el campo significa **"con qué versión se cumplió la obligación"**, no "con cuál se intentó" — eso ya lo guarda cada `Sesion`. `null` = todavía no se cumplió. Un intento desaprobado no lo toca; una aprobación posterior sobre una versión más nueva lo pisa.

**Aprobar no revoca la asignación**: sigue vigente porque la regla la sigue pidiendo, así que "pendiente" para la tablet es *vigente sin aprobación*.

## La base y el nivel NO se copian en `Respuesta`

Las estadísticas por base salen por join `Respuesta → Pregunta → BaseConocimiento`, sin columnas desnormalizadas.

Se difirió a propósito, con una advertencia en [`../pendientes.md`](../pendientes.md): la ventana para agregar esas columnas sin perder información **se cierra con el primer endpoint que permita reclasificar una pregunta**. Hoy no existe —el único `PATCH /preguntas/:id` es el toggle de papelera—, así que la clasificación actual de cada pregunta *es* la histórica.

## `SesionesModule` no importa `AsignacionesModule`, ni tiene controller propio

Aunque escribe en `asignaciones`, lo hace **por Prisma directo**, igual que `ModulosService` consulta `pregunta`. Evita el ciclo, porque `modulosAprobados()` consulta `sesion` en la dirección contraria.

Y **registrar una sesión no llama a `recalcular()`**: aprobar no crea ni revoca ninguna asignación.

Sin controller propio a propósito: los endpoints que consume la tablet viven en `tablet/`, que delega toda esta lógica en `SesionesService` en vez de reimplementarla, y el historial de rendiciones de una persona cuelga de `/usuarios/:id/informe`.

## `claveIdempotencia` la genera LA APP, no el backend

`String? @unique @map("clave_idempotencia")` en `Sesion`. Es un UUID por intento, creado al **empezar** la evaluación.

No lo sirve el backend al armar el examen a propósito: con el modo offline la app puede cachear un examen y rendirlo dos veces, y una clave que saliera del examen sería **la misma en los dos intentos**, así que el segundo se perdería en silencio contra el primero.

`registrar()` busca por esa clave **antes de cualquier validación** y, si la encuentra, devuelve la sesión existente sin crear ni revalidar nada — un reintento tiene que devolver lo que se guardó la primera vez aunque el estado haya cambiado después. Con un chequeo de que sea **del mismo usuario**: la clave la genera el cliente, así que una clave ajena no puede devolver la sesión de otra persona.

Un `@unique` plano alcanzó: en Postgres varios NULL no colisionan, así que no hizo falta un índice parcial. La traducción a status HTTP (`201` creó / `200` deduplicó) es de [tablet.md](./tablet.md#201-al-crear-200-al-deduplicar).

## `listarPorUsuario()` devuelve TODAS las sesiones, aprobadas y no

A diferencia de `modulosAprobados()` / `aprobacionesPorModulo()`, que sólo miran las aprobadas para decidir cobertura. El historial de una persona responde **"qué rindió"**, no "qué aprobó": un intento desaprobado es parte de su recorrido.

Vive en `SesionesService` y no en `UsuariosService` porque la query es sobre `sesion` — mismo precedente que `modulosAprobados()`: cada service consulta su propia tabla por Prisma directo.

## Las constraints se verificaron con `INSERT` directo, no con specs

Dos sesiones del mismo par entran; la misma pregunta dos veces en un intento no; una FK inexistente no; borrar una sesión con respuestas no. Son garantías de la base de datos que **ningún spec con Prisma mockeado puede ejercitar** — misma vía que se usó para las constraints de las bases de conocimiento y de los criterios de módulo.

Se sumó un humo end-to-end con `NestFactory.createApplicationContext` —la misma vía que usa el seed de demo— cubriendo desaprobar → reintentar → aprobar → revocar la asignación → recalcular sin que se re-cree.
