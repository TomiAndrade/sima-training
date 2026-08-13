# Decisiones — App tablet (SIMA CHECK)

Cubre el namespace HTTP `/tablet` del backend (su contrato propio, la autenticación de alumno y su guard), y la app `sima-check-app` como PWA instalable.

**No cubre**: la corrección y persistencia de lo que la tablet manda ([sesiones.md](./sesiones.md)) — `tablet/` delega en `SesionesService` y no reimplementa ninguna de esas reglas.

---

## El namespace HTTP

Son cuatro endpoints: `POST /tablet/login`, `GET /tablet/pendientes`, `GET /tablet/modulos/:id/examen` y `POST /tablet/sesiones`.

### Namespace y contrato propios, no un controller dentro de `sesiones/`

`src/tablet/` compone `sesiones` + `asignaciones` + `modulos` bajo un contrato que **nunca** expone `respuestaCorrecta`: ni en las preguntas del examen, ni en las opciones, ni en un campo derivado.

La garantía no depende de que la serialización la descarte bien — el `select` de Prisma en `TabletService.examen()` directamente no la trae, así que no hay forma de que viaje por accidente. Todo lo que sale de estos cuatro endpoints se ve abriendo las devtools del examen.

### Token de alumno separado del token de backoffice

Con su propio guard (`TabletAuthGuard`) y su propio payload: `{ sub, tipo: 'alumno' }`, contra `{ sub, type: 'backoffice' }` de `AuthService`. La clave (`tipo` vs `type`) **y** el valor son distintos a propósito, para que un token de un lado no pueda colarse en el otro por un error de tipeo en el chequeo.

El motivo de fondo: un atril compartido en portería no puede llevar credenciales de escritura del backoffice.

### Login PROVISIONAL sin PIN

El spike de autenticación ([`../autenticacion-tablet.md`](../autenticacion-tablet.md)) recomienda DNI + PIN, pero las tres preguntas abiertas para Eduardo (quién crea el PIN, cómo se resetea, qué exige ISO 9001) siguen sin respuesta, y conectar la tablet necesitaba algo con qué entrar mientras tanto.

`POST /tablet/login` valida sólo DNI, gateado por `TABLET_LOGIN_SIN_PIN` (default `true`); en `false` responde **501** en vez de fingir un flujo con PIN que no existe. El resto del diseño (PIN hasheado, entidad `Dispositivo`, enrolamiento por QR, rate limiting) sigue en [`../pendientes.md`](../pendientes.md).

### `201` al crear, `200` al deduplicar

Importa distinguirlos: es lo que le permite al modo offline saber si su reintento **efectivamente hizo algo**, sin tener que inspeccionar el body.

`SesionesService.registrar()` devuelve un booleano `duplicada` —adjuntado in-place con `Object.assign`, no un objeto nuevo, para no romper la igualdad por referencia que ya fijan sus specs de idempotencia— que el controller traduce a status con `@Res({ passthrough: true })`. El mecanismo de deduplicación en sí es de [sesiones.md](./sesiones.md#claveidempotencia-la-genera-la-app-no-el-backend).

### El `usuarioId` sale del token, nunca del body — vía un DTO propio

`RegistrarSesionTabletDto` es `RegistrarSesionDto` (el DTO interno de `SesionesService`) **sin** `usuarioId`; el controller lo completa con el `sub` del JWT.

Es un DTO propio y no un campo ignorado a propósito: con `forbidNonWhitelisted` global, mandar `usuarioId` en el body deja de ser un campo pisado en silencio y pasa a ser un **400** explícito (`"property usuarioId should not exist"`) — mismo mecanismo que ya blindaba `aprobada`/`porcentaje` en el DTO interno.

### El examen sirve sólo preguntas activas (asimetría intencional con `registrar()`)

`GET /tablet/modulos/:id/examen` filtra `activa: true` en el pivot **y** en la pregunta; `SesionesService.registrar()` no filtra por `activa` en ninguno de los dos.

Son momentos distintos: servir un examen nuevo con una pregunta que un admin ya desactivó no tiene sentido, pero una baja posterior no puede invalidar una rendición que ya se hizo. **No se "arregla" ninguno de los dos para que coincidan.**

### El tope de reintentos y la espera se aplican al SERVIR, no al registrar

Misma asimetría que la de arriba, y por el mismo motivo. `GET /tablet/modulos/:id/examen` cuenta los intentos ya gastados de esa persona en ese módulo (`tablet/reintentos.ts`, funciones puras) y responde **409** con el motivo — sin intentos, o con la fecha desde la que puede reintentar. `SesionesService.registrar()` no valida nada de eso: una rendición ya hecha se registra siempre.

Es lo que mantiene viable el modo offline: una sesión que se sincroniza tres días tarde no puede caerse por una ventana de espera que ya venció. El costo —alguien con un token de alumno y `curl` puede saltarse el tope— está aceptado y anotado en [`../pendientes.md`](../pendientes.md).

Por eso `examen()` pasó a recibir el `usuarioId`: el **contenido** del examen sigue siendo el mismo para cualquiera que rinda esa versión (el guard nunca verificó que la asignación fuera tuya), pero el derecho a pedirlo es personal.

### `pendientes` informa el bloqueo en vez de esconderlo

Cada ítem viaja con su `reintentos` (`puedeRendir`, `motivo`, `intentosUsados`, `intentosRestantes`, `proximoIntentoEn`). Un módulo bloqueado **sigue listado**, con el botón deshabilitado y el motivo debajo: la obligación no desapareció, sólo no se puede rendir todavía, y sacarlo de la lista haría creer que ya no hay que hacerlo — que es exactamente lo contrario.

Sin eso la única señal sería el 409 al tocar el botón, o sea descubrir el bloqueo después de haberlo intentado. El estado se recalcula también **después** de registrar una sesión y viaja en el resultado, para que la pantalla de Resultado sepa si ofrecer "Reintentar evaluación".

La regla la decide siempre el backend: `sima-check-app/src/core/reintentos.js` sólo traduce ese objeto a texto.

### Imágenes como `{ clave, url }`, con `url` relativa

La app muestra `url` y manda `clave` de vuelta como respuesta; `corregir.ts` compara esa clave cruda, nunca la URL armada (hay un spec que lo fija).

La `url` es **relativa** (`UPLOADS_PREFIX + clave`, sin ningún `BASE_URL`) porque el backend no conoce su propia URL pública, y la tablet la resuelve contra la misma API base que usa para todo lo demás. La función pura que hace la traducción se documenta en [infraestructura.md](./infraestructura.md#url-imagents-la-traducción-clave--url-relativa).

---

## La PWA

`sima-check-app` es instalable con `vite-plugin-pwa`. Lo que sigue es sólo sobre instalabilidad y actualización — el cacheo de **datos** (asignaciones, preguntas, rendiciones hechas sin conexión) no está implementado y vive en [`../pendientes.md`](../pendientes.md).

### `registerType: 'prompt'` + registro manual del service worker

Con `injectRegister: null`, el plugin no inyecta el script de registro automático: el service worker se registra a mano en `App.jsx` con el hook `useRegisterSW` de `virtual:pwa-register/react`.

Se eligió el registro manual sobre `injectRegister: 'auto'` porque el banner de actualización necesita leer `needRefresh` **dentro del árbol de React**, y con el registro automático ese estado no es accesible desde el componente.

### Qué entra al precache y qué no

`workbox.globPatterns` es explícito, no el default: entra el shell (`js/css/html/webmanifest`), los íconos de `icons/`, `apple-touch-icon.png`, `favicon.svg`, el logo y el fondo en WebP.

Queda afuera `SIMACHECK-FONDO.png`, el original sin convertir, que sigue en `public/` sin cachear.

Las **imágenes de las preguntas** tampoco entran, y no por una decisión de este precache: llegan del backend bajo `/uploads`, así que son runtime y no assets del build. Cachearlas es parte del offline de datos.

### El fondo se convirtió de PNG a WebP

`SIMACHECK-FONDO.png` (1,6 MB) → `SIMACHECK-FONDO.webp` (~57 KB, calidad 80). La conversión vive en `scripts/generar-iconos.mjs` (junto con la generación de íconos, a pesar del nombre) y corre con `npm run iconos`. El `.png` original se deja en `public/` sin borrar, por si hace falta regenerar el `.webp` con otros parámetros.

### El ícono maskable lleva fondo sólido y el logo al ~60% del lienzo

A diferencia de `icon-192` e `icon-512`, que son transparentes: Android recorta el ícono maskable a la forma que use el launcher del dispositivo (círculo, squircle, etc.), y un logo a tamaño completo sobre fondo transparente queda cortado por los bordes si esa forma es más chica que el lienzo.

### El banner de actualización se muestra sólo en dos pantallas

`BannerActualizacion.jsx` aparece con `needRefresh && (step === STEPS.usuario || step === STEPS.module)` — ingreso por DNI y capacitaciones pendientes —, **nunca durante la evaluación ni en el resultado**.

Motivo: toda la sesión de evaluación (preguntas sorteadas, respuestas marcadas) vive en estado de React y no en ningún storage, así que una recarga a mitad de rendir la pierde. Si el service worker detecta una versión nueva mientras la persona está rindiendo, `needRefresh` igual pasa a `true`, pero el banner no se renderiza hasta que vuelve a alguna de esas dos pantallas: no hace falta lógica de "actualización pendiente" aparte, alcanza con la condición del render. Como una evaluación dura pocos minutos, la actualización nunca queda esperando mucho.

### `orientation: portrait`, y las diferencias de iOS

Android respeta `orientation` cuando la PWA está instalada (bloquea la rotación); iOS la ignora. **No se fuerza por CSS a propósito** — pelear contra el comportamiento nativo de cada plataforma no vale la pena para una app pensada para tablet en mano.

iOS/Safari además **no dispara `beforeinstallprompt`** (se instala a mano desde Compartir → Agregar a pantalla de inicio) **e ignora los íconos declarados en el manifest**: por eso `apple-touch-icon.png` va declarado aparte con `<link rel="apple-touch-icon">` en `index.html`, no sólo en el manifest.
