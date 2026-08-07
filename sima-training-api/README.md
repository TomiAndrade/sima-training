# SIMA Training API

Backend de la plataforma **SIMA Training** — NestJS + PostgreSQL + Prisma.

Expone la API que consumen los frontends existentes (`sima-training-backoffice` y, a futuro, `sima-check-app`). Sprint 1: ABM de **Usuarios** y **Organizaciones** sobre datos reales, autenticación básica JWT y esqueleto de importación de Excel. Sprint 2: banco de **Preguntas** y **Módulos versionados** de SIMA CHECK. Sprint 3: **versionado real de módulos** (`ModuloVersion` con numeración pública `AÑO.MAYOR.MENOR`, borrador/activar/archivar, unassign duro de preguntas). Sprint 4: **imágenes en el enunciado y en las opciones** de una pregunta, servidas desde `/uploads`. Sprint 5: **modelo de vinculación** — `Usuario` queda como identidad pura y la pertenencia (organización, rol, pares puesto+centro de costo) se mueve a `Vinculacion` / `VinculacionPuestoCentro`; la clasificación SIMA/CLIENTE/SUBCONTRATISTA/INVITADO se elimina como concepto. Además: **asignaciones automáticas** — el par (puesto, centro de costo) de una persona obliga a rendir un módulo (`ReglaAsignacion`), y `AsignacionesService.recalcular()` deriva las `Asignacion` (`AUTOMATICA`/`MANUAL`) vigentes de cada usuario. Sprint 6: **clasificación del banco** — cada `Pregunta` apunta a una `BaseConocimiento` (el tema) y a un `NivelBase` de esa base (la dificultad, con escala propia por base); reemplaza a la vieja `Etiqueta`, que se elimina. Sprint 7: **composición de módulos por criterio** — una `ModuloVersion` puede declarar *qué evalúa* (`ModuloVersionCriterio`) y el backend materializa el pool de preguntas, conviviendo con la elección manual de siempre.

## Stack

- **NestJS 11** + TypeScript (monolito modular, organizado por dominio)
- **PostgreSQL 16** (local vía Docker Compose)
- **Prisma 6** (ORM + migraciones versionadas)
- **JWT** para autenticación básica (sin roles todavía)

## Requisitos

- Node.js 22+
- Docker Desktop (para la base PostgreSQL local)

## Setup local desde cero

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de entorno a partir del ejemplo
cp .env.example .env

# 3. Levantar PostgreSQL local (Docker)
docker compose up -d db

# 4. Aplicar migraciones (crea las tablas)
npx prisma migrate dev

# 5. Cargar datos base (organización interna + módulos)
npx prisma db seed

# 6. Correr en modo desarrollo (hot reload)
npm run start:dev
```

### Escenario de demo (`SEED_DEMO`)

El seed base deja la estructura mínima: Ingeniería SIMA y los 4 módulos en BORRADOR vacío. Para tener una base **navegable de punta a punta** (organización cliente → subcontratista, alumnos con pares puesto/centro, banco clasificado por base y nivel, un módulo publicado con su número `AÑO.MAYOR.MENOR` y asignaciones automáticas derivadas de reglas):

```powershell
$env:SEED_DEMO='true'; npx prisma db seed   # PowerShell
```

```bash
SEED_DEMO=true npx prisma db seed           # bash
```

Al terminar imprime los IDs de todo lo sembrado (organizaciones, base y niveles, módulo publicado, usuarios) para poder armar las llamadas de verificación sin abrir Prisma Studio.

Dos cosas a tener en cuenta:

- **Es destructivo y wholesale**, igual que el seed base: además de usuarios, organizaciones y módulos, la rama demo borra **todas** las preguntas, niveles y bases de conocimiento antes de sembrar. Es lo que la hace re-ejecutable.
- **Reusa los services** (`UsuariosService`, `ModulosService`, `ReglasAsignacionService`…) levantando un application context de Nest, en vez de escribir inserts crudos, para no saltearse la matriz rol↔organización, el appendeo de `orden`, el cálculo del número de versión ni el motor de recálculo. Lo único que no corre por esa vía es la `ValidationPipe` global, que es de la capa HTTP.

La API queda en **http://localhost:3000**. Verificá con:

```bash
curl http://localhost:3000/health
```

## Variables de entorno

Ver [`.env.example`](.env.example). Las principales:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto HTTP (default 3000) |
| `DATABASE_URL` | Conexión a PostgreSQL |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Firma y vigencia del token |
| `AUTH_USER` / `AUTH_PASSWORD` | Credenciales del backoffice (Sprint 1, login simple sin roles) |
| `CORS_ORIGINS` | Orígenes permitidos (frontends) |

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Servidor con hot reload |
| `npm run build` | Compila a `dist/` |
| `npm run lint` | ESLint |
| `npm test` | Tests unitarios (Jest) |
| `npx prisma migrate dev` | Crea/aplica migraciones en dev |
| `npx prisma db seed` | Carga los datos base (agregar `SEED_DEMO=true` para el escenario de demo) |
| `npx prisma studio` | Explorador visual de la base |

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | — | Estado del servicio |
| `GET` | `/uploads/*` | — | Archivos subidos (imágenes de preguntas). Lectura pública |
| `POST` | `/auth/login` | — | Login, devuelve `access_token` |
| `GET` | `/usuarios` | — | Lista paginada (`?page=`, `?limit=`, default 1/50), filtros `?organizacionId=` · `?rol=` · `?puestoId=` · `?centroCostoId=`, orden `created_at` desc. Responde `{ data, total, page, limit }`; cada usuario trae `vinculacion: { rol, organizacion, parPrincipal, pares }` (ver más abajo) |
| `POST` | `/usuarios` | JWT | Alta con su vinculación anidada: `{ nombre, apellido, dni, email?, datos?, vinculacion: { organizacionId, rol, pares?: [{ puestoId, centroCostoId }] } }`. 409 si el DNI ya está en uso (revive si pertenece a un usuario dado de baja); 400 si el rol no está permitido para el tipo de esa organización |
| `GET` | `/usuarios/:id` | — | Detalle (misma forma que el listado) |
| `PATCH` | `/usuarios/:id` | JWT | Edición. `vinculacion` acepta `organizacionId`/`rol`/`pares` sueltos; mandar `pares` **reemplaza el set completo**, omitirlo lo deja como está |
| `DELETE` | `/usuarios/:id` | JWT | Baja lógica (soft-delete) |
| `GET` | `/organizaciones` | — | Lista organizaciones |
| `POST` | `/organizaciones` | JWT | Alta (cliente o subcontratista) |
| `GET` | `/organizaciones/:id` | — | Detalle |
| `PATCH` | `/organizaciones/:id` | JWT | Edición |
| `POST` | `/import/usuarios/preview` | JWT | Preview de un `.xlsx` (no persiste). Columnas obligatorias `dni`/`nombre`/`apellido`/`puesto`/`centro de costo`, más `legajo` opcional al jsonb `datos`. Clasifica cada fila `ok`/`error` y, si es `ok`, resuelve puesto y centro contra el catálogo real (`duplicada`/`parecida` con score/`nueva`, mismo mecanismo de similitud que preguntas) |
| `POST` | `/import/usuarios/confirm` | JWT | Persiste la nómina. **JSON, no multipart**: el Excel no se re-sube — recibe `organizacionId` + `usuarios[]` ya resueltos por el frontend con `puestoId`/`centroCostoId` reales (obligatorios a nivel de DTO, así nunca entra un usuario sin par). Rol fijo `ALUMNO`; cada fila pasa por `UsuariosService.create` en su propio try/catch, heredando la matriz tipo-de-organización ↔ rol, el revive por DNI y el recálculo de asignaciones |
| `POST` | `/import/preguntas/preview` | JWT | Preview de un `.xlsx` de preguntas: clasifica cada fila como nueva/duplicada/parecida contra el banco (ver detección de similitud más abajo) |
| `POST` | `/import/preguntas/confirm` | JWT | Crea las preguntas ya elegidas por el usuario en el preview (body JSON, no re-sube el archivo); `moduloId?` opcional para asignarlas en el mismo gesto |
| `POST` | `/puestos` | JWT | Alta (rechaza nombre duplicado con 409) |
| `GET` | `/puestos` | — | Lista el catálogo. `?activo=true\|false` filtra; **sin el parámetro devuelve todo** (activos y dados de baja), que es lo que necesitan los consumidores que muestran el nombre de un puesto ya elegido y después desactivado |
| `PATCH` | `/puestos/:id` | JWT | Edición (nombre y/o `activo`, baja lógica) |
| `POST` | `/centros-costo` | JWT | Alta (rechaza nombre duplicado con 409) |
| `GET` | `/centros-costo` | — | Lista el catálogo. `?activo=true\|false` filtra; **sin el parámetro devuelve todo** (mismo criterio que `/puestos`) |
| `PATCH` | `/centros-costo/:id` | JWT | Edición (nombre y/o `activo`, baja lógica) |
| `GET` | `/bases-conocimiento` | — | Lista el catálogo con sus `niveles` anidados (ordenados por `orden`) y `_count.preguntas` por base y por nivel. `?activa=true\|false` filtra; **sin el parámetro devuelve todo** (mismo criterio que `/puestos`) |
| `POST` | `/bases-conocimiento` | JWT | Alta (`nombre`, y opcionales `codigo`/`descripcion`/`fuente`/`color`/`orden`). 409 si el nombre o el código ya existen |
| `GET` | `/bases-conocimiento/:id` | — | Detalle con sus niveles |
| `PATCH` | `/bases-conocimiento/:id` | JWT | Edita metadata y/o `activa` (baja lógica) |
| `POST` | `/bases-conocimiento/:id/niveles` | JWT | Alta de un nivel de la escala. `orden` es opcional: si no viene se appendea al final; si viene ocupado, 409. 409 también si el nombre ya existe en esa base |
| `PATCH` | `/bases-conocimiento/:id/niveles/:nivelId` | JWT | **Sólo renombra.** `orden` no se edita acá (ver la fila siguiente) |
| `PUT` | `/bases-conocimiento/:id/niveles/orden` | JWT | Reordena la escala: body `{ nivelIds: [...] }` con el set **completo** en el orden deseado (400 si falta, sobra o repite alguno). Reindexa en dos pasadas porque el índice `(base_conocimiento_id, orden)` no es diferible — ver Decisiones de diseño |
| `DELETE` | `/bases-conocimiento/:id/niveles/:nivelId` | JWT | Elimina un nivel de la escala. 409 si tiene preguntas asignadas (hay que reclasificarlas primero) |
| `POST` | `/preguntas` | JWT | Alta, con clasificación opcional `baseConocimientoId`/`nivelId`/`fuente`. Si no viene `fuente`, se copia de la base y **queda congelada**. 400 si el nivel no pertenece a la base, o si viene `nivelId` sin `baseConocimientoId`. No corre detección de duplicados/similares (eso solo pasa en el preview del import de Excel) |
| `POST` | `/preguntas/imagen` | JWT | Sube la imagen de un enunciado u opción (multipart `file`, máx 2 MB, formato detectado por magic bytes). Devuelve `{ imagen: "preguntas/<uuid>.png" }` para mandar en el `imagen` del alta |
| `DELETE` | `/preguntas/imagen/:clave` | JWT | Borra una imagen huérfana (clave url-encoded). 409 si alguna pregunta la sigue referenciando (enunciado u opción) |
| `GET` | `/preguntas` | — | Lista, filtros `?q=` (texto), `?activa=` (papelera global si `false`), `?baseId=`/`?nivelId=`/`?sinBase=true` (clasificación, combinan con AND; `sinBase` es el backlog sin clasificar). Cada pregunta trae `base` y `nivel` anidados, `?moduloId=` (repetible, OR entre sí), `?sinAsignar=true` (OR con `moduloId`). Cada pregunta trae `modulos: [{moduloId, moduloNombre, activaEnModulo}]` con sus asignaciones vigentes |
| `GET` | `/preguntas/:id` | — | Detalle |
| `PATCH` | `/preguntas/:id` | JWT | Papelera global: `{ activa: false }` desactiva la pregunta y cascadea `activa=false` a todas sus asignaciones por módulo (solo en versiones BORRADOR/ACTIVO, nunca ARCHIVADO); `{ activa: true }` la recupera pero **no** restaura los pivots (el admin reactiva módulo por módulo) |
| `GET` | `/modulos` | — | Lista todos los módulos con `vigente: {estado, anio, mayor, menor}` y `borradorId` si hay un borrador en curso |
| `POST` | `/modulos` | JWT | Crea el módulo y su `ModuloVersion` v1 en BORRADOR |
| `GET` | `/modulos/:id` | — | Módulo + versión activa (o la última) + sus preguntas (activas e inactivas, cada pivot con su `origen` CRITERIO/MANUAL) + sus **criterios** (con `base` y `nivel` resueltos) |
| `PATCH` | `/modulos/:id` | JWT | Edita metadata del módulo: `nombre`, `descripcion`, `activo` (baja lógica del módulo entero, independiente del ciclo de sus versiones) y `vigenciaMeses` |
| `GET` | `/modulos/:id/versiones` | — | Historial de versiones (más reciente primero), con `preguntasCount` por versión |
| `GET` | `/modulos/:id/versiones/:versionId` | — | Detalle de una versión puntual (incluye ARCHIVADO) + sus preguntas |
| `POST` | `/modulos/:id/versiones` | JWT | Crea un borrador nuevo copiando los pivots de preguntas del ACTIVO. Rechaza si ya hay un borrador en curso o si no hay ACTIVO del cual partir |
| `PATCH` | `/modulos/:id/activar` | JWT | Publica el borrador vigente (body `{esNuevaLinea?}`, obligatorio solo si ya hay un ACTIVO del cual derivar el número). Asigna el número `AÑO.MAYOR.MENOR` y archiva el ACTIVO anterior — transaccional |
| `DELETE` | `/modulos/:id/borrador` | JWT | Descarta el borrador en curso (con sus pivots y sus criterios). Si era la única versión (módulo nunca publicado), elimina el módulo entero |
| `PUT` | `/modulos/:id/criterios` | JWT | Reemplaza el set **completo** de criterios de la versión en edición: `{ criterios: [{ baseConocimientoId, nivelId? }] }` (`nivelId` ausente = cualquier nivel de esa base; array vacío = sacar todos). **Materializa el pool de preguntas en el acto** y devuelve `{ version, criterios, resolucion: { agregadas, quitadas, conservadas, porCriterio } }`. Sólo sobre un BORRADOR (409 si no); 400 si hay criterios repetidos, o si la base/nivel no existen o no se corresponden |
| `POST` | `/modulos/:id/preguntas` | JWT | Asigna preguntas existentes a la versión BORRADOR (array `{ preguntaId, orden?, obligatoria? }` — `orden` se appendea si no viene; 409 si ya está asignada, 404 si la pregunta no existe) |
| `PATCH` | `/modulos/:id/preguntas/:preguntaId` | JWT | Activa/desactiva la asignación de una pregunta **en la versión que se edita** (baja lógica por módulo, reversible; distinta de la papelera global de `/preguntas/:id`) |
| `DELETE` | `/modulos/:id/preguntas/:preguntaId` | JWT | Unassign duro del pivot (a diferencia del toggle anterior, no reversible). Solo sobre un BORRADOR — rechaza con 409 sobre ACTIVO/ARCHIVADO, **y también si el pivot es `origen: CRITERIO`**: quitarla a mano no sirve porque la resolución siguiente la vuelve a materializar (la vía es "Desactivar", cuya baja sí sobrevive a las resoluciones) |
| `GET` | `/asignaciones` | — | Lista las asignaciones (vigentes y revocadas) de una persona, `?usuarioId=` |
| `POST` | `/asignaciones` | JWT | Alta MANUAL de una asignación puntual. 409 si ya hay una vigente de ese módulo para esa persona (índice único parcial) |
| `POST` | `/asignaciones/recalcular/:usuarioId` | JWT | Deriva las AUTOMATICA a partir de los pares (puesto, centro) activos y las reglas vigentes: crea las que faltan y revoca las que ya no corresponden. Nunca toca las MANUAL. Devuelve `{ creadas, revocadas }`. **Los dos caminos normales ya lo disparan solos**: editar los pares de una persona (`UsuariosService`) y tocar una regla de su centro (`ReglasAsignacionService`), los dos dentro de su propia transacción. Queda como reconciliación manual para lo que ninguno de los dos cubre — ojo que **no** cubre dar de baja un `Puesto`/`CentroCosto` del catálogo: el motor no mira `Puesto.activo`, así que ahí este endpoint tampoco cambia nada |
| `PATCH` | `/asignaciones/:id/revocar` | JWT | Revoca una asignación (nunca se borra). Idempotente |
| `GET` | `/reglas-asignacion` | — | Lista reglas, filtros `?puestoId=`/`?centroCostoId=`/`?moduloId=`/`?activo=`/`?alcance=PUESTO\|CENTRO`. `?puestoId=` es **literal**: trae sólo las de ese puesto, no las de centro |
| `POST` | `/reglas-asignacion` | JWT | Alta de una regla. Con `puestoId` → regla por par exacto; **sin `puestoId` → regla de CENTRO** (aplica a todos los puestos de ese centro). Si la misma regla ya existe dada de baja **o eliminada**, reactiva/revive esa misma fila en vez de duplicar |
| `PATCH` | `/reglas-asignacion/:id` | JWT | `{ moduloId?, activo? }`, al menos uno. `activo` es la pausa reversible; `moduloId` corrige a qué módulo obliga la regla. **El alcance (puesto/centro) no se edita**: moverla de lugar es eliminarla y crear otra. Ojo: el backoffice **sólo manda `activo`** — `moduloId` está implementado y testeado pero hoy no tiene consumidor (la pantalla Reglas edita por diff alta+baja, para que el módulo anterior quede registrado; ver `CLAUDE.md`) |
| `DELETE` | `/reglas-asignacion/:id` | JWT | Elimina la regla: **baja lógica** (`deletedAt`), la fila nunca se borra — es la única evidencia de por qué alguien tuvo que rendir un módulo. Eje distinto de `activo`: deja de listarse y de matchear, y no hay filtro para verla desde el backoffice. Volver a crear el mismo triple **revive esta misma fila** |

> Las **tres mutaciones** de `/reglas-asignacion` (`POST`/`PATCH`/`DELETE`) devuelven `{ regla, recalculo: { usuarios, creadas, revocadas } }`, no la regla pelada: recalculan en la misma transacción las `Asignacion` AUTOMATICA de toda la gente con un par activo en el centro de esa regla. La consecuencia no se ve en el listado de reglas — lo que cambia son las asignaciones de otras personas.

Las **lecturas** (`GET`) son abiertas; las **escrituras** requieren `Authorization: Bearer <token>`.

### Forma de un usuario

El rol y la organización van **anidados en la vinculación** (dejaron de ser campos planos de `Usuario`), y el par principal se expone aparte para que el listado tenga una sola fila puesto/centro que mostrar:

```jsonc
{
  "id": 4, "nombre": "Ana", "apellido": "Paz", "dni": "30111222", "datos": {},
  "vinculacion": {
    "id": 7, "rol": "ALUMNO", "activa": true,
    "organizacion": { "id": 6, "nombre": "Contratista Sur", "tipo": "SUBCONTRATISTA" },
    // Solo display: el alumno rinde los módulos de TODOS sus pares, no solo del principal.
    // null mientras la vinculación no tenga ningún par cargado.
    "parPrincipal": { "puesto": { "nombre": "Soldador" }, "centroCosto": { "nombre": "YPF Loma Campana" }, "principal": true, "activo": true },
    "pares": [ /* … el mismo puesto en dos centros son dos pares distintos … */ ]
  }
}
```

`vinculacion` es `null` solo en usuarios previos al modelo de vinculación: el alta siempre la exige (`Vinculacion.organizacionId` es NOT NULL).

## Estructura del proyecto

```
src/
├── auth/            Login JWT + guard (sin roles, Sprint 1)
├── usuarios/        ABM de Usuario (identidad pura) + su Vinculacion y sus pares,
│                    anidados en el mismo request. matriz-rol-organizacion.ts:
│                    la matriz tipo-de-organización ↔ rol, compartida con el import
├── organizaciones/  ABM de Organizacion (cliente/subcontratista, jerarquía)
├── puestos/         Catálogo de Puesto (baja lógica con `activo`)
├── centros-costo/   Catálogo de CentroCosto (baja lógica con `activo`)
├── import/          Importación de nómina y de preguntas desde Excel (exceljs)
│                    + similitud.ts (detección de duplicados/parecidas, en memoria)
│                    La nómina delega el alta en UsuariosService (misma validación)
├── bases-conocimiento/  BaseConocimiento (taxonomía temática del banco: "Gestión de
│                    residuos") + NivelBase (su escala ordinal de dificultad, propia
│                    de cada base). Reemplaza a la vieja Etiqueta
├── preguntas/       Alta/listado de Pregunta (banco único, reutilizable entre módulos)
│                    + imagen de enunciado/opciones (sube/borra, StorageModule)
├── modulos/         Modulo + ModuloVersion (versionado inmutable, numeración pública
│                    AÑO.MAYOR.MENOR) + los DOS caminos para armar su contenido:
│                    el pivot manual de preguntas y ModuloVersionCriterio con su
│                    resolverCriterios() (declarar el tema y materializar el pool)
├── asignaciones/    Asignacion (obligación de una persona de rendir un módulo) +
│                    ReglaAsignacion (qué módulo exige cada par puesto+centro) +
│                    AsignacionesService.recalcular() (deriva las AUTOMATICA)
├── storage/         StorageService abstracto + LocalDiskStorage (uploads/) +
│                    formato-imagen.ts (detección por magic bytes)
├── prisma/          PrismaService + módulo global
├── health/          Health check
├── app.module.ts
└── main.ts          ValidationPipe global + CORS + static assets de /uploads
prisma/
├── schema.prisma    Usuario, Vinculacion, VinculacionPuestoCentro, Organizacion,
│                    Puesto, CentroCosto, Pregunta, BaseConocimiento, NivelBase,
│                    Modulo, ModuloVersion, ModuloVersionCriterio,
│                    ReglaAsignacion, Asignacion + pivots
├── seed.ts          Organización interna (Ingeniería SIMA) + módulos base, y el
│                    escenario de demo detrás de SEED_DEMO=true.
│                    Limpia en orden de dependencia (las FK son ON DELETE RESTRICT)
└── migrations/      Migraciones versionadas
```

## Despliegue (pendiente)

`Dockerfile` y `render.yaml` están preparados pero **no activos**. Para desplegar a la nube hay que crear la cuenta en Render/Railway y conectar el repo — ver comentarios en [`render.yaml`](render.yaml). El CI (`.github/workflows/ci-sima-training.yml`) corre lint + build + test + un smoke test de `start:prod` (levanta el server contra un Postgres real del job y verifica `/health`), sin paso de deploy todavía.

**Storage al deployar**: va object storage (S3 o Cloudflare R2), no disco persistente — el plan free de Render no ofrece discos, y el contenedor es efímero (cada redeploy borraría `UPLOADS_DIR` con `LocalDiskStorage`). Falta escribir la implementación nueva de `StorageService` (ver `docs/pendientes.md`); el storage está detrás de una interfaz chica así que no toca schema, controllers ni frontend.

## Decisiones de diseño (Sprint 1)

- **`Usuario` es una sola entidad** para cualquier persona (cuenta de sistema y/o persona evaluada). El rol vivió en `Usuario` de forma transitoria y ya migró a `Vinculacion` (Sprint 5).
- **Trazabilidad** (`created_at/updated_at/created_by/updated_by`) y **soft-delete** (`deleted_at`) desde el día 1.
- **Campo `datos` (jsonb)** en `Usuario` para datos de nómina flexibles. Hoy lo escribe únicamente el import de Excel y, desde que puesto y centro de costo se resuelven contra el catálogo real, guarda solo `legajo` — ya no hay mapeo abierto de columnas no reconocidas. El ABM de Usuarios no lo edita ni lo muestra.

## Decisiones de diseño (Sprint 2 — SIMA CHECK)

- ~~**`clasificacion` es una columna persistida y editable en `Usuario`**~~ — **revertido en el Sprint 5**: la clasificación se disolvió como concepto (columna eliminada). La pertenencia se deriva de `Organizacion.tipo` + la cadena de `organizacionPadreId`, que era justamente la "derivación pura" que este bullet anticipaba como migración chica. `INVITADO` quedó fuera del modelo.
- **Banco de preguntas único y reutilizable**: `Pregunta` nunca se duplica; se comparte entre módulos vía el pivot `ModuloVersionPregunta` (N a N).
- **Módulos versionados e inmutables**: `Modulo` es un contenedor estable; el contenido real vive en `ModuloVersion`. Editar un módulo activo crea una versión nueva — las versiones anteriores quedan `ARCHIVADO` y no se modifican ni se pierden.
- **Tipos de pregunta**: `VERDADERO_FALSO` / `OPCION_MULTIPLE` / `OPCIONES_IMAGEN` mapean 1:1 a `truefalse` / `multiple` / `image-options` del frontend mockeado. `TEXTO_LIBRE` se agregó al enum para uso futuro, sin implementación todavía.
- **Dos bajas lógicas distintas para `Pregunta`, no una sola**: `ModuloVersionPregunta.activa` es la baja **por módulo** (Sprint 2, no afecta otros módulos ni el banco). `Pregunta.activa` es la **papelera global** (Sprint 3): saca la pregunta de todo el banco y cascadea `activa=false` a todas sus asignaciones por módulo; recuperarla de la papelera **no** restaura esas asignaciones (asimetría intencional — el admin decide dónde reactivarla).
- **Detección de duplicados/similares: resuelto en memoria, no con pg_trgm** (`src/import/similitud.ts`). Se normaliza el texto en español (sin acentos/puntuación) y se compara por coeficiente de Dice sobre trigramas de caracteres, contra el banco completo y contra las filas del mismo archivo. Se prefirió esta vía a la extensión `pg_trgm` de Postgres porque el proyecto es local-first sin deploy cloud activo todavía, y para no atar la portabilidad a que el Postgres administrado permita `CREATE EXTENSION`; queda encapsulado en funciones puras, reemplazable el día que el banco crezca lo suficiente.
- **Importación de preguntas por Excel con preview seleccionable**: cada fila del `.xlsx` se clasifica como nueva/duplicada/parecida; el usuario elige fila por fila cuáles importar en el preview (`POST /import/preguntas/preview`), y el confirm (`POST /import/preguntas/confirm`) recibe esa selección ya armada como JSON (no vuelve a leer el archivo), con un `moduloId` de destino opcional.
- ~~**Pendiente para el próximo sprint**: `PATCH /modulos/:id/aprobar`~~ — **resuelto con otro diseño**: el Sprint 3 (versionado) lo reemplazó por `PATCH /modulos/:id/activar`, que publica el borrador directamente (sin un paso de aprobación separado). El AuditLog para ISO 9001 sigue sin implementar.

## Decisiones de diseño (Sprint 3 — Versionado de módulos)

- **Numeración pública de 3 partes `AÑO.MAYOR.MENOR`** (ej. `2026.01.00`), distinta del `numeroVersion` interno (contador monotónico de creación). Se asigna recién al Activar — un borrador sin publicar se muestra como "Borrador", sin número. **Actualización** sube MENOR; **Versión nueva** sube MAYOR y resetea MENOR (MAYOR es la secuencia del módulo por año).
- **La elección actualización/versión nueva (`esNuevaLinea`) se decide al Activar, no al crear el borrador** — da tiempo a ver cuánto se terminó modificando antes de comprometerse. Es obligatoria solo cuando ya hay un ACTIVO publicado del cual derivar el número.
- **A lo sumo un BORRADOR y un ACTIVO por módulo.** `crearVersion` copia los pivots de preguntas del ACTIVO (punto de partida = lo publicado, no vacío) y rechaza si ya hay un borrador en curso.
- **`activar` es transaccional**: calcula el número, pasa el borrador a ACTIVO y el ACTIVO anterior (si había) a ARCHIVADO — nunca quedan dos ACTIVO simultáneos.
- **`cancelarBorrador` descarta el borrador en curso** (y sus pivots). Si era la única versión del módulo (nunca se publicó), borra el `Modulo` entero — mismo endpoint para los dos casos, el backoffice solo cambia el label del botón.
- **Unassign duro (`DELETE /modulos/:id/preguntas/:preguntaId`) solo sobre BORRADOR**, a diferencia del toggle de activo/inactivo (que también aplica sobre lo publicado, por ser reversible). Borrar un pivot de ACTIVO/ARCHIVADO rompería la inmutabilidad del historial.

## Decisiones de diseño (Sprint 4 — Imágenes en el enunciado)

- **Storage detrás de una interfaz chica** (`StorageService.guardar/borrar`), para que migrar a S3 sea escribir otra implementación sin tocar schema, controllers ni frontend. `LocalDiskStorage` escribe en `UPLOADS_DIR` (default `./uploads`); la base guarda una **clave opaca**, nunca una ruta de filesystem ni una URL absoluta.
- **El formato se detecta por magic bytes**, no por `originalname`/`mimetype` del cliente (`storage/formato-imagen.ts`). El nombre de archivo es siempre un uuid generado — evita path traversal. Límite de 2 MB.
- **La subida va separada del alta** (`POST /preguntas/imagen` devuelve la clave, después se manda en el `imagen` del `POST /preguntas`): así el DTO de alta no cambió y el frontend puede mostrar preview antes de confirmar.
- **La imagen de una pregunta ya creada no se reemplaza ni se borra** — no hay endpoint de edición (coherente con "las preguntas no se editan, se activan/desactivan") y porque todas las versiones de un módulo comparten el mismo `preguntaId`: mutar la imagen cambiaría retroactivamente versiones ARCHIVADO. Para cambiarla: papelera + pregunta nueva. `DELETE /preguntas/imagen/:clave` responde 409 si alguna pregunta la referencia (enunciado u opción).

## Decisiones de diseño (Asignaciones automáticas por par)

- **`ReglaAsignacion` es el motor de las `Asignacion` automáticas**, y tiene **dos alcances que conviven**: con `puestoId` es una regla por **par exacto** (puesto, centro de costo) —"Soldador en YPF" puede pedir módulos distintos que "Soldador en PAE"—; con `puestoId` en **null** es una regla de **centro de costo**, que aplica a todos los puestos de ese centro (la rinde cualquiera con algún par activo ahí). Un soldador de Taller alcanzado por las dos recibe los dos módulos. Apunta a `Modulo` (el contenedor), no a una `ModuloVersion`: la obligación es "este módulo", la versión concreta se resuelve al rendir.
- **La unicidad de las reglas vive en DOS índices parciales, y la tabla no declara ningún `@@unique`.** Los dos existen sólo en el SQL de la migración `20260729171533_reglas_asignacion_soft_delete` — Prisma no expresa `WHERE` en `@@unique`, así que el `@@unique([puestoId, centroCostoId, moduloId])` que generaba se **dropeó** ahí mismo (no distinguía filas vivas de eliminadas: una regla eliminada seguía bloqueando la creación de otra con el mismo triple).

  | Índice | Columnas | Predicado |
  |---|---|---|
  | `reglas_asignacion_par_modulo_vivas` | `(puesto_id, centro_costo_id, modulo_id)` | `deleted_at IS NULL` |
  | `reglas_asignacion_centro_modulo_sin_puesto` | `(centro_costo_id, modulo_id)` | `puesto_id IS NULL AND deleted_at IS NULL` |

  Los dos predicados son **ortogonales**: `puesto_id` elige qué **alcance** gobierna el índice, `deleted_at` elige qué **filas** están vivas — por eso se combinan en vez de unificarse. El primero cubre exactamente las reglas **con** puesto (con `puesto_id` NULL, Postgres considera cada fila distinta de las demás, así que las de centro se le escapan) y el segundo tapa esa mitad. Tienen que ser parciales por partida doble: un UNIQUE común sobre (centro, módulo) impediría que la regla de centro y las de par del mismo centro+módulo coexistan, y uno sin `WHERE deleted_at` haría que "volver a agregar" una regla eliminada choque en vez de revivirla.
- **`Asignacion` nunca se borra, se revoca** (`revocadaAt`). Un índice único parcial (`WHERE revocada_at IS NULL`) garantiza a lo sumo una vigente por (usuario, módulo) — vive solo en la migración SQL, Prisma no lo expresa.
- **`recalcular()` es síncrono, idempotente y nunca toca las `MANUAL`.** Compara las reglas vigentes que le aplican a la persona —las de sus pares activos **más** las de centro de los centros donde tiene algún par activo— contra sus asignaciones vigentes: crea las AUTOMATICA que faltan, revoca las AUTOMATICA que ya no pide ninguna regla. Un módulo pedido por una regla de centro **y** una de par es **una sola** asignación (los módulos requeridos se unifican en un `Set`). Correrlo dos veces seguidas no duplica ni revoca de más.
- **Se auto-invoca desde `UsuariosService`**, dentro de la misma transacción que cambió los pares, con guards asimétricos a propósito: el alta recalcula solo si trae pares; la rama de **revivir** un DNI dado de baja recalcula **siempre** (puede arrastrar AUTOMATICA vigentes de antes); el PATCH recalcula solo si el request tocó `pares` (mandar `pares: []` cuenta); y el DELETE **no** recalcula — solo setea `deletedAt`, que es justamente por qué la rama de revivir no lleva guard.
- **Tocar una REGLA también recalcula**, y cierra la asimetría que había con el ABM de usuarios. `ReglasAsignacionService` inyecta `AsignacionesService`, y las tres mutaciones (`create`/`update`/`remove`) llaman a `recalcularCentro()` **dentro de la misma transacción** que cambió la regla: si algo falla se revierte todo junto y no quedan asignaciones derivadas de una regla que no se llegó a guardar. Por eso las tres devuelven `{ regla, recalculo: { usuarios, creadas, revocadas } }` y no la regla pelada — la consecuencia real no se ve en el listado de reglas, lo que cambia son las asignaciones de otra gente.
  - **El fan-out es acotado y no hace falta un job en background**: a quien alcanza una regla —de par exacto o de centro— es siempre alguien con un par **activo** en ese centro de costo, así que el centro alcanza como filtro para los dos alcances (`usuariosAlcanzados`). Se excluyen los usuarios dados de baja, porque `recalcularEnTx` los rechaza con un 404 que abortaría la transacción entera.
  - El timeout de la transacción se sube a 15 s (`TX_TIMEOUT_MS`; el default de Prisma son 5) porque adentro corre un recálculo por persona, no una sola query.
- ⚠️ **Lo que sigue SIN recalcular: dar de baja un `Puesto` o un `CentroCosto` del catálogo.** `recalcularEnTx` mira `VinculacionPuestoCentro.activo` y `ReglaAsignacion.activo`/`deletedAt`, **nunca** `Puesto.activo` ni `CentroCosto.activo`, y ni `PuestosService` ni `CentrosCostoService` inyectan el motor — así que los pares y las reglas que apuntan a un puesto dado de baja siguen generando obligaciones, y `POST /asignaciones/recalcular/:usuarioId` **tampoco lo corrige**. Puede ser el comportamiento correcto (el `activo` de los catálogos significa "no ofrecerlo más en los selects", no "invalidar lo ya cargado"), pero está sin decidir explícitamente — ver [`../docs/pendientes.md`](../docs/pendientes.md).
- **El registro de aprobaciones es un hueco explícito**, aislado en `AsignacionesService.modulosAprobados()` (devuelve un Set vacío hasta que exista la entidad de aprobaciones — bloqueado por la conexión de la app tablet). `moduloVersionId` en `Asignacion` queda `null` por el mismo motivo.

## Decisiones de diseño (Sprint 5 — Modelo de vinculación)

- **`Usuario` es identidad pura; la pertenencia vive en `Vinculacion`** (una por usuario, con `usuarioId @unique`: la regla "una sola organización por persona" la verifica Postgres, no el service). `rol`, `organizacionId` y `clasificacion` salieron de `Usuario`. No hay endpoints `/vinculaciones`: la vinculación se crea y edita **anidada** en `/usuarios`, porque no tiene ciclo de vida propio.
- **Puesto y centro de costo van apareados en `VinculacionPuestoCentro`**, no como dos ejes independientes: la capacitación obligatoria depende del **par** (*"Soldador en YPF" ≠ "Soldador en PAE"*), y el mismo puesto en dos centros son dos filas. Por eso el filtro `?puestoId=&centroCostoId=` es exacto (quien ejerce ese puesto *dentro de* ese centro), y no devuelve a quien tiene los dos por separado. Solo matchea pares con `activo: true`.
- **`principal` es solo display, con el manejo mínimo.** El alumno rinde los módulos de **todos** sus pares, así que el principal no decide nada más que qué fila muestra el listado: el primer par cargado queda principal y no hay herencia automática ni promoción al desactivarlo (que se muestre un par inactivo es cosmético). Nota técnica por si algún día hace falta un swap: van **dos UPDATEs en una transacción** (bajar el viejo, subir el nuevo) — el índice único parcial `UNIQUE (vinculacion_id) WHERE principal AND activo` no es diferible y un `updateMany` único lo violaría a mitad de camino. Hoy no existe ningún flujo de swap.
- **La matriz tipo-de-organización ↔ rol se valida en el service, no en el DTO**: cruza dos tablas (rol en `Vinculacion`, tipo en `Organizacion`), así que class-validator no puede expresarla y tampoco hay CHECK constraint posible sin un trigger. `src/usuarios/matriz-rol-organizacion.ts` la expone como función pura que devuelve el motivo del rechazo o `null` — no lanza, para que el alta lo convierta en 400 y el import lo reporte como error de fila sin abortar el archivo.
- **El import de nómina no reimplementa el alta**: `ImportService.confirmarUsuarios` arma un `CreateUsuarioDto` por fila y llama a `UsuariosService.create(dto, 'import')`. Así la matriz, el revive-por-DNI y la trazabilidad son literalmente el mismo código en los dos caminos. El rol quedó **fijado a `ALUMNO`** y la organización se elige una sola vez en el modal (el Excel ya no tiene columnas `rol`/`empresa`/`email`/`sector`), porque `Vinculacion.organizacionId` es NOT NULL y una nómina de alumnos contra una organización `CLIENTE` la matriz la rechaza — el frontend filtra los tipos válidos antes de dejar analizar el archivo.
- **El listado no oculta a quien no tiene pares.** Las condiciones sobre `vinculacion` se agregan al `where` solo si el filtro correspondiente viene; sin filtros, aparecen también las personas con cero pares (cardinalidad válida: el pivote arranca vacío) y su `parPrincipal` viaja en `null`.
- **Un solo `include` para lista y detalle** (`USUARIO_INCLUDE`), y por lo tanto una sola forma de respuesta. Se devuelve `pares` completo además de `parPrincipal` para no tener dos contratos según el endpoint.
- **El PATCH de `pares` reemplaza el set completo, no mergea**: borra los que había y crea los de la lista, en una transacción y borrando antes de crear (por el índice único parcial de `principal`). Omitir `pares` los deja intactos.
- **El seed borra en orden de dependencia**: `Asignacion` → `ReglaAsignacion` → `VinculacionPuestoCentro` → `Vinculacion` → `Usuario` → `Organizacion` (hijas de la jerarquía primero) → pivots y versiones de módulo → `Modulo`; y en la rama demo, además, `Pregunta` → `NivelBase` → `BaseConocimiento`. Casi todas las FK son `ON DELETE RESTRICT`, así que hay que ir siempre de las hijas a las padres, y **esta cadena ya se rompió tres veces por estar incompleta**: el orden original (`usuario.deleteMany()` primero) solo funcionaba con la base sin vinculaciones; `Asignacion` se agregó después y tiene FK **directa** a `Usuario` sin pasar por `Vinculacion`; y `ReglaAsignacion` faltaba del todo, con FK a `Modulo`/`Puesto`/`CentroCosto` — con reglas cargadas, el `modulo.deleteMany()` fallaba con `reglas_asignacion_modulo_id_fkey`. Antes de reusar o extender este orden con una tabla nueva, grepear el schema entero por FKs hacia el target en vez de asumir que la cadena documentada está completa.
  - Las únicas dos FK que **no** son RESTRICT son `Asignacion.moduloVersionId` y la self-FK `Organizacion.organizacionPadreId`, las dos `SET NULL`. Ojo con la segunda: el `onDelete` **no figura en `schema.prisma`**, hay que leerlo en el SQL (`20260624033224_init/migration.sql:45`). El seed igual borra las organizaciones hijas primero, para no depender de cómo Postgres resuelve la acción RI sobre una fila que el mismo statement está borrando.
- **Los frontends ya consumen la forma nueva.** `Usuarios.jsx` lee y escribe `vinculacion` anidada e incluye el ABM de pares; `clasificacion` no aparece en ningún frontend. La app tablet nunca tuvo `rol`/`clasificacion` en su mock, así que no requería migración.

## Decisiones de diseño (Sprint 6 — Bases de conocimiento y niveles)

Salió del pedido de clasificar las preguntas por tema y dificultad (*"Gestión de residuos - Básico"*). El diagnóstico que ordenó el diseño: los módulos reales (`SIMA Básico`/`Intermedio`/`Avanzado`) **ya eran el eje dificultad**, con el tema disuelto adentro — no era agregar metadata, era **separar dos ejes colapsados en uno**.

- **`Etiqueta` se eliminó, no se extendió.** Cumplía la misma función pero como N a N de tags libres y opcionales, y estaba **muerta**: el seed no creaba ninguna, el import no asignaba y ningún frontend mandaba `etiquetaIds` (verificado con grep sobre los tres subproyectos y con `SELECT count(*)` sobre las dos tablas antes de dropearlas: 0 filas). Lo único que se perdió es el eje **nominal** (agrupar por subtema además de por nivel); si reaparece, va una entidad nueva y deliberada.
- **La base NO se versiona — es taxonomía, no contenido.** "Gestión de residuos" como materia es la misma en 2020 y en 2026; lo que cambia es qué se considera correcto adentro. Cuando sale un manual nuevo: papelera a las preguntas obsoletas, alta de las nuevas en la **misma** base, y versión nueva de los módulos que la evalúan — los dos mecanismos de versionado que ya existen alcanzan. Se descartó **una base por manual** ("Gestión de Residuos 2026") porque parte las estadísticas justo en el eje que se quiere medir, y **versionar la base** porque obligaría a que los criterios de módulo apunten a una *versión* de base. El año/revisión sale de `fuente`, nunca del nombre.
- **El nivel es ordinal y la escala es POR BASE**, por eso `NivelBase` es tabla y no enum: una base puede necesitar 3 niveles y otra 5. Un enum global impondría la misma escala a todas.
- **La coherencia base↔nivel la garantiza la base de datos, no el service.** `Pregunta` tiene dos FK: la simple a `BaseConocimiento` y una **compuesta** `(nivelId, baseConocimientoId)` → `NivelBase(id, baseConocimientoId)`. Para eso existe el `@@unique([id, baseConocimientoId])` de `NivelBase`, que no es una unicidad de negocio sino el requisito de Postgres para poder referenciar esas columnas. Se eligió sobre un `findFirst` previo en el service porque un chequeo en memoria no sobrevive a dos altas concurrentes.
- **Un CHECK escrito a mano tapa el agujero de MATCH SIMPLE.** Las FK compuestas no se evalúan si *alguna* columna es NULL. Eso es deseado para `(base cargada, nivel NULL)` —"tema definido, dificultad pendiente" es válido— pero dejaría pasar el inverso. De ahí `preguntas_nivel_requiere_base`: `CHECK (nivel_id IS NULL OR base_conocimiento_id IS NOT NULL)`, que **vive sólo en el SQL de la migración** `20260731143856`; Prisma no lo conoce ni lo introspecta. `ModuloVersionCriterio` tiene la misma FK compuesta pero **no** necesita este CHECK: ahí `baseConocimientoId` es NOT NULL.
- **Las tres constraints se verificaron con `INSERT` directo antes de escribir el service**: nivel de otra base → rechazado por la FK compuesta; nivel sin base → rechazado por el CHECK; base sin nivel → aceptado. El rechazo se traduce a **400, no a 500**: la FK llega como `P2003`, pero el CHECK llega como `PrismaClientUnknownRequestError` **sin código de Prisma** (es un `23514` crudo de Postgres), así que se identifica por el nombre de la constraint.
- **`baseConocimientoId` es nullable en la base pero obligatorio en el formulario.** El banco ya tenía preguntas cargadas y no hay forma de derivar la base del texto; un `NOT NULL` habría exigido inventar una base "sin clasificar" para todas. El filtro `?sinBase=true` es lo que permite ir limpiando ese backlog.
- **`Pregunta.fuente` se congela al crear**, copiándola de la base si el alta no trae una propia (`resolverFuente`). Sin esto, actualizar la fuente de la base al salir un manual nuevo haría que las preguntas viejas —las que ese manual dejó obsoletas— pasen a citar el manual nuevo.
- **Reordenar la escala reindexa TODO, en dos pasadas.** El índice `(base_conocimiento_id, orden)` **no es diferible**, así que mover niveles de a uno lo viola a mitad de camino aunque estén en la misma transacción (mismo problema que el `principal` de `VinculacionPuestoCentro`). `PUT /:id/niveles/orden` recibe la escala completa y, en una transacción: (1) toda la escala a negativos, (2) cada nivel a su posición final — los rangos nunca se solapan. Se eligió sobre el intercambio a tres UPDATEs porque ese sólo cubre *swaps* y se rompe al mover un nivel a una posición arbitraria.
  - ⚠️ La pasada 1 va en `tx.$executeRaw`: `orden = -orden - 1` referencia la propia columna, y el `data` de Prisma sólo acepta literales o sus operaciones atómicas. Por eso `PATCH /:id/niveles/:nivelId` **sólo renombra**: no hay una segunda vía para tocar `orden`.
  - **`orden` es ordinal, NO contiguo.** Borrar el nivel del medio de `0,1,2` deja `0,2` a propósito: la unicidad se mantiene y el orden relativo no cambia, que es lo único que `orden` significa. `eliminarNivel` **no reindexa**; `reordenarNiveles` es lo único que renumera. Consecuencia: `siguienteOrden` usa `max(orden)+1`, así que borrar y agregar repetido hace subir los números sin que vuelvan a bajar. Hay un spec que fija esta decisión para que no se "arregle" sola.
- **El import de Excel no necesitó cambios.** `ConfirmarImportPreguntasDto.preguntas` es `CreatePreguntaDto[]` y `confirmarPreguntas` pasa cada fila entera a `PreguntasService.create`, así que la clasificación viaja **dentro de cada pregunta**. El modal estampa la base/nivel elegidos en cada fila y el backend autocompleta la `fuente`.

## Decisiones de diseño (Sprint 7 — Composición de módulos por criterio)

Es la **Entrega B** de bases de conocimiento. Hasta acá una `ModuloVersion` se armaba enumerando preguntas una por una; ahora puede además declarar **qué evalúa** (`ModuloVersionCriterio`: base + nivel opcional) y dejar que el backend materialice el pool. Los dos caminos **conviven**: el pivot lleva `origen` (`CRITERIO`/`MANUAL`) y eso es lo que permite que la resolución sepa qué filas le pertenecen.

- **`cantidadPreguntas` se sacó del diseño original.** Iba a ser cuántas preguntas sortear por examen de cada criterio, pero **no tiene consumidor**: la tablet sortea 3 fijas y no lee el backend. Guardarlo ahora lo dejaba en la misma situación que `Modulo.vigenciaMeses` — un campo que se persiste, aparece en formularios y no gobierna ninguna regla. Se agrega como columna nullable, sin backfill, cuando exista el sorteo real (ver [`../docs/pendientes.md`](../docs/pendientes.md)).
- **El pool materializa TODAS las preguntas que matchean**, no una muestra: congelar unas pocas haría que todos los alumnos rindan exactamente las mismas y se pierde la aleatorización.
- **Snapshot, no receta viva.** `PUT /:id/criterios` materializa los pivots sobre el BORRADOR y `activar()` los publica **sin volver a resolver** (hay un spec que lo fija). Resolver al rendir dejaría a una versión `ARCHIVADO` como puntero a un pozo que se mueve por debajo, y no se podría reconstruir qué se pudo tomar en una fecha — que es todo el motivo del versionado del Sprint 3. **Costo aceptado**: una pregunta cargada después de publicar no entra sola ni a la versión publicada ni al borrador que se cree a partir de ella; entra recién cuando el admin vuelve a guardar los criterios.
- **La resolución es un UPSERT, no un replace**, y ahí está toda la sutileza:

  | Caso | Acción |
  |---|---|
  | Matchea y ya tiene pivot `CRITERIO` | **No se toca** — preserva un `activa: false` puesto a mano, y hace la resolución idempotente |
  | Matchea y no tiene ningún pivot | Se inserta `origen: CRITERIO`, `activa: true`, `orden = max+1` |
  | Pivot `CRITERIO` que ya no matchea | **Se borra**, esté activo o desactivado |
  | Pivot `MANUAL` | **Nunca se toca** (misma regla que `recalcular()` con las `Asignacion` MANUAL) |

  El pivot `CRITERIO` huérfano se borra **aunque estuviera desactivado a mano** porque es estado derivado: sacado el criterio se queda sin ninguna razón de estar. Se descartó **promoverlo a `MANUAL`**: reescribe el origen en silencio y deja sin respuesta "¿qué trajo el criterio?". Una pregunta que **ya es `MANUAL`** y además matchea conserva su origen — no se pueden tener dos filas (la PK es (versión, pregunta)) y pisarle el origen sería tocar una MANUAL.
- **El pool sólo toma preguntas con `activa: true`**, y es **literalmente el mismo filtro que `GET /preguntas?baseId=&nivelId=&activa=true`** — a propósito: el backoffice previsualiza el conteo con ese endpoint, y por eso no hizo falta uno de dry-run. Corolario: mandar una pregunta a papelera la saca del pool y la resolución siguiente **borra** su pivot `CRITERIO`.
- **Un criterio que matchea CERO preguntas se guarda igual**, con el conteo en 0. Declarar el tema antes de cargar las preguntas es un flujo válido, y rechazarlo obligaría a cargar preguntas para poder declarar qué se evalúa. Tampoco bloquea Activar: publicar un módulo sin preguntas ya era posible.
- **Unicidad: `@@unique` de Prisma MÁS un índice parcial a mano.** El `@@unique([moduloVersionId, baseConocimientoId, nivelId])` cubre sólo la mitad `nivel_id NOT NULL` (con NULL, Postgres no impide declarar dos veces "cualquier nivel de esta base"); la otra mitad la cubre `modulo_version_criterio_base_sin_nivel` (`WHERE nivel_id IS NULL`). A diferencia de `ReglaAsignacion` —que dropeó su `@@unique` entero porque `deleted_at` atraviesa los dos alcances— acá no hay soft-delete y el `@@unique` plano se conserva. Las cuatro combinaciones se verificaron con `INSERT` directo antes de escribir el service: son constraints que ningún spec con Prisma mockeado puede ejercitar.
- **`unassignPregunta` rechaza con 409 los pivots `CRITERIO`.** Quitarla a mano no sirve: la resolución siguiente la vuelve a materializar. El mensaje dice que la vía es **"Desactivar"** y —lo que importa— que **esa baja sobrevive a las resoluciones siguientes**; sin esa segunda mitad, alguien que quiere sacar UNA pregunta termina borrando el criterio entero y se lleva puestas todas las demás. Hay un spec que fija las dos partes del mensaje.
