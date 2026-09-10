# Autorización por rol

Quién puede hacer qué. La autenticación —quién sos— vive en [infraestructura.md](infraestructura.md#login-del-backoffice-auth0-story-4-no-credenciales-propias); acá está lo que pasa después.

## Dos guards globales, en ese orden

`JwtAuthGuard` resuelve la identidad y `RolesGuard` decide si esa identidad puede ejecutar la ruta. Los dos son `APP_GUARD` y **el orden de registro es funcional, no estético**: `RolesGuard` lee `request.usuario`, que es lo que deja `JwtAuthGuard` al resolver el token contra `Usuario`+`Vinculacion`. Invertidos, `request.usuario` viene `undefined` y **todas** las rutas autenticadas responden 403. Es un error fácil de cometer moviendo líneas y barato de detectar: cualquier request falla, no un subconjunto raro.

Que el rol salga de la `Vinculacion` y no del token es una consecuencia del modelo, no una elección de este guard: el token es de Auth0 y Auth0 no sabe nada de roles de SIMA. Por eso `GET /auth/me` existe (ver abajo).

## Fail-closed, y por qué eso obligó a decorar 61 endpoints de una

Una ruta sin `@Roles()` **no queda abierta: queda inaccesible para todos**, administradores incluidos.

La alternativa era un default permisivo ("sin decorador, cualquiera autenticado pasa"), y se descartó por el modo de falla. Con el default permisivo, olvidarse el decorador en un endpoint nuevo no rompe nada visible — el endpoint anda, y andar es exactamente lo que hace que nadie lo mire. El agujero se descubre auditando, o no se descubre. Con fail-closed, el mismo olvido rompe la pantalla que consume ese endpoint, en el primer click, y se arregla ese día.

El costo es que la transición no se podía hacer de a poco: activar el guard con la mitad de las rutas decoradas dejaba la otra mitad muerta. Por eso los **61** endpoints detrás del guard (22 GET + 39 escrituras) se decoraron en el mismo commit que lo activó, y no en una serie de commits por dominio.

Las **10 rutas `@Public()`** (`/health`, `/uploads/*`, las 4 de tablet y las 4 de invitado) salen por un early return antes de mirar roles. No es una optimización: se autentican con su propio guard y su propio token, así que ahí no hay ningún `request.usuario` que mirar, y sin el early return el guard se llevaría puesta la app de la tablet entera.

## La matriz vive en un archivo, no en los controllers

`src/auth/matriz-permisos.ts` exporta tres conjuntos y los controllers los referencian (`@Roles(...LECTURA_BACKOFFICE)`). Mismo criterio que `usuarios/matriz-rol-organizacion.ts`, que ya resolvía así la otra matriz del dominio.

El motivo es poder responder *"¿qué puede hacer un COORDINADOR?"* leyendo un archivo. Con los roles enumerados endpoint por endpoint, esa pregunta —que es la que se hace cuando alguien pide un permiso nuevo— obliga a abrir 13 controllers y confiar en no haberse salteado ninguno.

| Conjunto | Quiénes | Qué cubre |
|---|---|---|
| `LECTURA_BACKOFFICE` | ADMINISTRADOR · COORDINADOR · AUDITOR | Las 22 lecturas |
| `GESTION_NOMINA` | ADMINISTRADOR · COORDINADOR | Personas, catálogos, asignaciones y reglas |
| `SOLO_ADMINISTRADOR` | ADMINISTRADOR | Contenido y estructura |

La línea entre los dos últimos es **personas vs. contenido**: el coordinador administra gente (su trabajo diario), el administrador define qué se evalúa. Publicar una versión de un módulo le cambia el examen a toda la nómina, así que no es una operación del día a día de nadie más.

**Decorar las 22 lecturas con los tres roles no amplía nada**: es exactamente el acceso que ya tenían. El AUDITOR queda con lectura completa de la nómina —acotarlo a "algunos subcontratistas" necesita un vínculo que no existe en ninguna tabla (ver [pendientes](../pendientes.md))— y eso es una decisión tomada, no un descuido.

## La excepción: `PATCH /usuarios/:id`

Es el único lugar del proyecto donde la autorización **no** vive en un decorador, y la razón es estructural: `@Roles()` autoriza el endpoint entero, y acá el problema está adentro del body.

`PATCH /usuarios/:id` es `GESTION_NOMINA` porque un coordinador tiene que poder editar a su gente. Pero `UpdateVinculacionDto` deja tocar `rol` y `organizacionId`, así que con sólo el decorador **un COORDINADOR se asciende a ADMINISTRADOR con un curl, editándose a sí mismo**. Ningún decorador de endpoint puede filtrar campos de un body.

El chequeo está en `UsuariosService.update()` y tiene tres detalles que importan:

- **Compara siempre contra `actual`**, el estado leído de la base, nunca contra algo que haya mandado el cliente.
- **Cambio significa valor distinto**, no campo presente: el frontend reenvía el objeto `vinculacion` entero al editar cualquier otro campo, así que rechazar por "mandó el rol" haría que un coordinador no pueda cambiar un par sin comerse un 403, y el chequeo se volvería inservible en la práctica.
- **`actorRol` sin valor cuenta como "no es administrador"** — mismo criterio fail-closed que el guard. Se llama `actorRol` y no `actor` porque ese nombre ya estaba tomado por el string que va a `updatedBy` y al AuditLog: son dos cosas distintas y se parecen demasiado.

`POST /usuarios` no necesita el parche: ya es ADMINISTRADOR-only.

**Vector de escalada por import, verificado y descartado**: dar `import/usuarios/*` a COORDINADOR es seguro porque la confirmación hardcodea `rol: ALUMNO` y el DTO de cada fila no tiene campo `rol` (con `forbidNonWhitelisted` global, mandarlo es un 400).

## Cómo se garantiza que no falte ninguno

`src/auth/roles-cobertura.spec.ts` recorre la **metadata que Nest lee en runtime** y exige que cada handler tenga `ROLES_KEY` o `IS_PUBLIC_KEY`.

No es un grep: no se lo puede engañar con un `@Roles` escrito en un comentario ni se le escapa un decorador puesto en el lugar equivocado. Y no levanta la app —importa las clases y lee su metadata con Reflect—, porque atarlo a tener Postgres corriendo lo habría convertido en un test que se saltea, que es lo peor que le puede pasar a un test de autorización. Descubre los controllers recorriendo el árbol de archivos, así que uno nuevo entra solo.

Cubre además dos casos que no son "falta el decorador":

- **`@Public()` y `@Roles()` juntos** son siempre un malentendido: `@Public()` gana en el guard, así que alguien creyó estar restringiendo algo que en realidad quedó abierto a cualquiera sin token.
- **Un snapshot de la matriz efectiva** (método + ruta → roles), commiteado, para que un `@Roles` cambiado de lugar aparezca en el diff del PR en vez de pasar callado.

## `GET /auth/me` y el rol en el frontend

El backoffice **no sabía su propio rol**: Auth0 le da un token y el rol vive en la `Vinculacion` de este backend. `GET /auth/me` devuelve la identidad ya resuelta — la misma que el guard usa para autorizar, así que no pueden divergir.

Del lado del cliente lo pide `SesionProvider` **una vez por sesión**, no por pantalla: el rol no cambia mientras alguien está logueado. Va adentro del gate de Auth0 de `App.jsx` y no en `main.jsx`, porque necesita el token ya registrado en `client.js`.

Un fallo de ese request **no bloquea la app**: `identidad` queda en `null` y la UI cae al comportamiento más restrictivo. Fallar cerrado del lado del cliente es lo coherente con el backend — que es quien decide de verdad; esto sólo decide qué se muestra.

El primer consumidor es el **select de rol de `Usuarios.jsx`**, que antes no existía para nadie (el rol era un badge de solo lectura para todos, administradores incluidos). Ahora un ADMINISTRADOR puede cambiarlo; COORDINADOR y AUDITOR siguen viendo el badge. El PATCH manda `vinculacion.rol` sólo si el select existe **y** cambió —mismo patrón que `paresTouched`—, que es lo que evita pisar en silencio el rol de alguien al editarle el nombre. Cambiar el rol limpia la organización elegida si la matriz tipo-de-organización ↔ rol ya no la permite, en vez de mandar una combinación que el backend rechaza con 400.

## Lo que queda pendiente

**Verificar los 403 contra producción.** Hoy existen dos usuarios y los dos son ADMINISTRADOR: no hay ninguna cuenta de coordinador ni de auditor con la cual comprobar que los 403 caen donde tienen que caer. Los tests cubren la lógica; lo que falta es la vuelta contra el deploy real, y no se puede automatizar sin esas cuentas.
