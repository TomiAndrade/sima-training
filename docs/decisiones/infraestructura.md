# Decisiones — Infraestructura

Cubre lo transversal a todos los dominios: la forma del monolito, la autenticación del backoffice, la trazabilidad y el soft-delete, el almacenamiento de archivos, el deploy, el seed con su orden de borrado, y las constraints que Prisma no conoce.

**No cubre**: nada de un dominio puntual. Si una decisión se puede explicar diciendo "de `Pregunta`" o "de `Asignacion`", va al archivo de ese dominio aunque toque una tabla o un archivo compartido.

Tampoco cubre **cómo se trabaja** en el repo —qué comandos correr, cómo verificar un cambio, las trampas de lint— que vive en [`../../CLAUDE.md`](../../CLAUDE.md) porque hace falta a mano mientras se trabaja, no cuando se busca el porqué de un diseño.

---

## Forma del sistema

### Monolito modular por dominio, no microservicios

Un solo deploy. Cada entidad futura se agrega como un **módulo NestJS nuevo**, no como un cambio transversal — es lo que hace que sumar un dominio no obligue a tocar los que ya andan.

### Trazabilidad y soft-delete desde el día 1

`created_at` / `updated_at` / `created_by` / `updated_by` y `deleted_at` en las entidades del modelo desde la primera migración: **barato ahora, caro de retrofittear**.

Con matices por entidad que se decidieron después, y que valen como precedente: `Sesion` es inmutable y **no** lleva soft-delete ([sesiones.md](./sesiones.md#sesion-es-inmutable-y-no-lleva-soft-delete)), `AuditLog` tampoco ([auditoria.md](./auditoria.md#el-borrado-físico-de-los-pares-se-vuelve-legítimo-gracias-a-esta-decisión-no-a-pesar-de-ella)), y `Asignacion` usa `revocadaAt` en vez de `deletedAt` porque revocar y borrar son cosas distintas.

### Auth básica sin roles

El backoffice se autentica con credenciales de entorno (`AUTH_USER` / `AUTH_PASSWORD`); el cliente hace auto-login y cachea el token en memoria, sin pantalla de login todavía. **Lecturas abiertas, escrituras con JWT.**

Es provisorio y está atado a que la abstracción de roles del sistema no está definida (ver [`../pendientes.md`](../pendientes.md)): por eso el único admin previsto entra por `.env` en vez de ser un `Usuario`, y el alta del backoffice está fijada a ALUMNO ([usuarios.md](./usuarios.md#frontend-el-alta-está-fijada-a-alumno)).

El token de la tablet es **otro**, con su propio guard y su propio payload, a propósito: ver [tablet.md](./tablet.md#token-de-alumno-separado-del-token-de-backoffice).

### Local-first: PostgreSQL en Docker Compose

La base corre local vía `docker compose up -d db`; requiere Docker Desktop. Es lo que permite trabajar sin depender de ninguna cuenta cloud, y es también el argumento que decidió resolver la detección de duplicados **en memoria** en vez de con una extensión de Postgres ([preguntas.md](./preguntas.md#detección-de-duplicados-y-similares-en-memoria-no-con-pg_trgm)).

### Deploy preparado, no activo

`Dockerfile` y `render.yaml` están listos, y el CI corre lint + build + test + un smoke test de `start:prod`. Lo que falta es crear la cuenta y conectar el repo — el CI **no tiene paso de deploy** hasta que eso pase.

El estado y lo que bloquea (una implementación de object storage, ver abajo) viven en [`../pendientes.md`](../pendientes.md).

---

## Storage de archivos

### `StorageService` detrás de una interfaz chica, con dos implementaciones

La clase abstracta expone `guardar(buffer, carpeta, extension) → clave`, `borrar(clave)` y `leer(clave) → ArchivoLeido` (stream + content-type + length + etag). Dos implementaciones, elegidas por `STORAGE_DRIVER` en `StorageModule` (factory con `ConfigService` inyectado, no una var de compilación — así se puede probar R2 de verdad desde development sin deployar):

- **`local`** (default): `LocalDiskStorage` escribe en `UPLOADS_DIR` (default `./uploads`, gitignoreado). Alcanza para desarrollar sin credenciales de nadie.
- **`r2`**: `R2Storage`, contra Cloudflare R2 vía el SDK de S3 (`@aws-sdk/client-s3` — R2 expone una API compatible). Es la que va en cualquier deploy: el plan free de Render no tiene disco persistente y el contenedor es efímero, así que con `local` el primer redeploy pierde todas las imágenes y la base queda con claves apuntando a la nada. `render.yaml` fija `STORAGE_DRIVER=r2` explícitamente — no confiar en que nadie se olvide de setearlo en el dashboard.

**La base guarda una clave opaca** (`preguntas/<uuid>.png`), nunca una ruta de filesystem ni una URL absoluta — es lo que hace que migrar de driver no toque el schema, ni el único consumidor (`PreguntasService`), ni los frontends.

**Se eligió R2 y no S3 por el egreso: R2 no lo cobra, S3 sí.** Es el único rubro que podía escalar con el uso real (imágenes servidas a tablets en campo), y a la escala del proyecto (~264 personas, imágenes ≤2MB) los dos son centavos en almacenamiento — verificado contra las páginas de precios oficiales antes de decidir, no de memoria. Como la API de R2 es la misma de S3, la decisión no encierra: mudarse es cambiar variables de entorno, no código.

### El backend sigue siendo el intermediario, no el bucket

`UploadsController` (`src/storage/uploads.controller.ts`) reemplazó al `useStaticAssets` que había en `main.ts` — ese sólo sabía leer del disco local. Ahora `GET /uploads/*` le pide el archivo a `StorageService` y lo streamea, así que **la URL no cambió** con ninguno de los dos drivers: sigue siendo `/uploads/preguntas/<uuid>.png`, y ni `resolverUrlImagen()` (`url-imagen.ts`) ni los frontends se tocaron.

La alternativa —bucket público, la tablet baja directo de Cloudflare— era más rápida y no consumía ancho de banda del servidor, y **se descartó a propósito**: son fotos de instalaciones de clientes de Oil & Gas, y el backend de intermediario deja el control de acceso en **un solo lugar** el día que haga falta pedir un token para verlas. Al revés (público → privado) obliga a migrar las URLs ya guardadas. El costo medido —Render free da 100 GB/mes de banda, la estimación generosa da ~2.6 GB/mes— es despreciable a esta escala, y ese tráfico **ya existía** con `useStaticAssets`: no es un costo nuevo.

Dos detalles de la implementación:

- **`leer()` devuelve un stream, no un `Buffer`**: con varias tablets pidiendo imágenes de hasta 2MB a la vez, bufferear el archivo entero en memoria antes de responder sería RAM gastada sin necesidad.
- **La clave se valida con lista blanca** (`carpeta/uuid.ext`) en el controller, no buscando `..`: cualquier cosa que no matchee ese formato no es una clave que este backend haya podido emitir. Verificado con curl contra varias formas de path traversal (`../../.env`, encoded, etc.) — todas dan 404 sin tocar el storage.
- **Cache-Control agresivo** (`public, max-age=31536000, immutable`): la clave lleva un uuid y el contenido de una clave es inmutable (`Pregunta.imagen` no se reemplaza, ver `preguntas.md`), así que una tablet no necesita volver a pedir la misma imagen entre intentos.

Hoy la lectura sigue siendo **pública**, igual que con `useStaticAssets`: la app del alumno pide las imágenes sin token. Eso no cambió — lo que cambió es que ahora hay un solo lugar donde restringirlo el día que haga falta.

### El formato se detecta por magic bytes, no por `originalname` ni `mimetype`

Los dos son input del cliente y se pueden mentir. `storage/formato-imagen.ts` lo resuelve con funciones puras, al estilo de `similitud.ts`.

La extensión con la que se guarda sale del **tipo detectado**, y el nombre es siempre un uuid generado: construir un path con el `originalname` sería path traversal. Límite de 2 MB — multer aborta con 413, y el service revalida para dejar el mensaje en castellano si esa red falla.

### `borrarImagen` mira los dos lugares donde puede vivir una clave

La columna `imagen` (el enunciado) **y** el jsonb `opciones`. Mirar sólo la columna —como hacía al principio— dejaba borrar una imagen de opción que estaba en uso, rompiendo la pregunta en silencio.

### `url-imagen.ts`: la traducción clave → URL relativa

Función pura, mismo estilo que `formato-imagen.ts`. Traduce la clave opaca a `UPLOADS_PREFIX + clave` **sin prefijar con ningún `BASE_URL`**: el backend no conoce su propia URL pública, así que el cliente la resuelve contra la misma API base que usa para todo lo demás.

Las rutas legacy que dejó el import de Excel (`/images/x.png`) se devuelven tal cual, sin prefijar. El uso desde el contrato de la tablet está en [tablet.md](./tablet.md#imágenes-como--clave-url--con-url-relativa); el equivalente del backoffice, en [preguntas.md](./preguntas.md#imagenurl-centraliza-la-traducción-clave--url-en-el-backoffice).

---

## Seed

### El seed base siembra estructura, no contenido — y un módulo es contenido

El seed base quedó en **una sola cosa**: la organización interna "Ingeniería SIMA". Es la única fila que cualquier entorno necesita sí o sí, porque sin una organización no se puede dar de alta a nadie.

Sembraba además **cuatro módulos con uuid hardcodeado** (`SIMA Básico`/`Intermedio`/`Avanzado`/`Reglas de Oro`). No eran arbitrarios: eran la contraparte real de los cuatro del mock `sima-check/data/training-modules.js`, con id fijo porque el backoffice los referenciaba por `backendId` mientras la pantalla de módulos seguía mockeada. Ese campo **ya no existe** — la pantalla es 100% backend desde hace varios sprints — así que lo único que quedó de esa deuda fueron cuatro módulos vacíos apareciendo al lado de cualquier módulo creado de verdad, en cualquier base recién sembrada.

La línea es: **estructura la siembra el seed, contenido lo crea quien lo necesita.** Un módulo es una decisión de negocio (qué se capacita, con qué preguntas, cada cuánto se recertifica), no un prerrequisito técnico.

El beneficio de fondo es que se fue el **acoplamiento por uuid entre los dos modos del seed**, que estaba marcado con una advertencia en el propio código: `sembrarDemo()` poblaba el `SIMA Básico` del seed base por su uuid literal, así que tocar la lista de módulos de un modo rompía el otro con un `NotFoundException` a distancia. Ahora `sembrarDemo()` crea sus dos módulos con `modulos.create()` (que ya deja la `ModuloVersion` v1 en BORRADOR) y usa los ids devueltos: la rama demo es autocontenida.

### Toda entidad nueva con FK RESTRICT tiene que entrar a `limpiar()`, en orden

Casi todas las FK del schema son `ON DELETE RESTRICT`, así que una tabla nueva que no se agregue a la cadena de borrado **bloquea el `deleteMany()` de su padre** y rompe el seed.

Esto **se rompió varias veces**, siempre igual, y las entidades que lo dispararon fueron `Asignacion`, `ReglaAsignacion`, `ModuloVersionCriterio` y `Sesion`/`Respuesta`. Dos motivos por los que se escapa tan fácil:

- **El síntoma aparece recién en la SEGUNDA corrida.** Sobre una base vacía no hay filas hijas que bloqueen nada, así que la corrida en la que se agrega la entidad pasa limpia y el error sale después, como un `..._fkey` opaco de la corrida siguiente. Por eso **la verificación de cualquier cambio al seed es correrlo dos veces seguidas**, no una.
- **La cadena documentada puede estar incompleta** — es exactamente lo que falló todas las veces. Antes de reusarla o extenderla, grepear el `schema.prisma` entero por FKs hacia la tabla target en vez de asumir que está al día. Los comentarios del propio `seed.ts` también quedaron atrasados más de una vez.

### El orden de borrado

El que vale es el de `prisma/seed.ts`, no el de ningún documento. De las hijas a las padres:

```
auditLog                    (sin FK saliente: va primera sólo por reproducibilidad)
respuesta → sesion          (las más hijas de todas)
asignacion → reglaAsignacion
vinculacionPuestoCentro → vinculacion → usuario
organizacion (hijas de la jerarquía primero, después el resto)
moduloVersionPregunta → moduloVersionCriterio → moduloVersion → modulo
```

Y en la rama demo, que corre después: `pregunta → nivelBase → baseConocimiento`.

Por qué cada tramo está donde está:

- **`Sesion` y `Respuesta` van primeras** porque son las más hijas: `Sesion` cuelga de `Usuario`, `ModuloVersion` **y** `Asignacion`, o sea que bloquea las tres ramas de abajo —incluida la de asignaciones, que antes arrancaba el orden—. `Respuesta` cuelga de `Sesion` y de `Pregunta`, así que además desbloquea el borrado de preguntas del demo.
- **`Asignacion` es su propia rama** porque tiene FK **directa** a `Usuario`, sin pasar por `Vinculacion`.
- **`ReglaAsignacion`** tiene FK a `Modulo`, `Puesto` y `CentroCosto`: sin ella, el borrado de módulos falla con `reglas_asignacion_modulo_id_fkey`.
- **`ModuloVersionCriterio`** es la tercera rama que cuelga de `ModuloVersion`, y también desbloquea el borrado de bases del demo por la FK criterio → base.
- **`Organizacion` se borra en dos pasos** (primero las hijas de la jerarquía, después el resto). Con la self-FK en `SET NULL` un `deleteMany()` único probablemente funcionaría, pero no vale la pena depender de cómo Postgres resuelve la acción RI sobre una fila que el mismo statement está borrando.

Las **únicas dos FK que no son RESTRICT** son `Asignacion.moduloVersionId` y la self-FK `Organizacion.organizacionPadreId`, las dos `SET NULL`. Ojo con la segunda: **el `onDelete` no figura en `schema.prisma`**, hay que leerlo en el SQL de la migración inicial.

### El escenario de demo reusa los services de Nest, no inserts crudos

`sembrarDemo()` levanta un application context con `NestFactory.createApplicationContext` y llama a los services reales, en vez de escribir en la base directo.

El motivo es que un insert crudo **se saltea las reglas que viven en los services**: la matriz rol↔organización, `resolverFuente`, el appendeo de `orden`, la resolución de criterios, el cálculo del número de versión y el motor de recálculo. Un escenario de demo sembrado por afuera de esas reglas puede quedar en un estado que la aplicación nunca produciría, y entonces no sirve para demostrar nada.

Lo único que no corre por esa vía es la `ValidationPipe` global, que vive en `main.ts` y sólo aplica a la capa HTTP.

Va detrás de `SEED_DEMO=true` y apagado por defecto porque son **datos de demostración, no estructura**. Es destructivo y wholesale igual que el seed base: la rama demo borra todas las preguntas, niveles y bases antes de sembrar, y eso es lo que la hace re-ejecutable.

---

## Migraciones y constraints

### Hay constraints que Prisma no conoce, y sólo viven en el SQL de las migraciones

Son **dos familias**: índices únicos **parciales** (Prisma no expresa `WHERE` en `@@unique`) y **CHECK** escritos a mano.

La consecuencia práctica es que **Prisma no los recrea**: un `db push` sobre una base limpia, o regenerar la tabla, los deja afuera en silencio. La base queda aceptando datos que la aplicación asume imposibles.

De ahí la convención: **toda migración que toque esas tablas se verifica leyendo el SQL generado, no el `.prisma`.**

La lista canónica —qué índices existen hoy, en qué migración y con qué predicado— vive en [`../pendientes.md`](../pendientes.md), que es donde hace falta a mano al escribir una migración. El **porqué** de cada uno vive en su dominio: el `principal` de los pares en [usuarios.md](./usuarios.md#principal-es-sólo-display-con-el-manejo-mínimo), los dos de `ReglaAsignacion` y el de `Asignacion` en [asignaciones.md](./asignaciones.md#la-unicidad-vive-en-dos-índices-parciales-y-la-tabla-no-declara-ningún-unique), el CHECK de `Pregunta` en [preguntas.md](./preguntas.md#la-coherencia-basenivel-la-garantiza-la-base-de-datos-no-el-service) y el parcial de `ModuloVersionCriterio` en [modulos.md](./modulos.md#unicidad-unique-de-prisma-más-un-índice-parcial-a-mano).

### Toda relación opcional nueva decide su `onDelete` a propósito

El default de Prisma para una relación `?` es `SetNull`, y **no siempre es seguro**.

El caso que lo puso en evidencia: `ReglaAsignacion.puesto` es opcional porque `puestoId = null` significa "regla de centro". Con el default, borrar un `Puesto` habría convertido en silencio una regla de par exacto en una **regla de centro**, aplicándola de golpe a todos los puestos de ese centro. Se fuerza `onDelete: Restrict`.

La regla general para el schema es que una relación opcional nueva no herede el default sin pensarlo — **y que se verifique el SQL de la migración generada**, porque el `onDelete` efectivo no se lee en el `.prisma` cuando es el default. Es el mismo problema que la self-FK de `Organizacion`, cuyo `SET NULL` sólo aparece en el SQL.
