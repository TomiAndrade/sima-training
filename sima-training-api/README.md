# SIMA Training API

Backend de la plataforma **SIMA Training** — NestJS + PostgreSQL + Prisma.

Expone la API que consumen los frontends existentes (`sima-training-backoffice` y, a futuro, `sima-check-app`). Sprint 1: ABM de **Usuarios** y **Organizaciones** sobre datos reales, autenticación básica JWT y esqueleto de importación de Excel. Sprint 2: banco de **Preguntas** y **Módulos versionados** de SIMA CHECK. Sprint 3: **versionado real de módulos** (`ModuloVersion` con numeración pública `AÑO.MAYOR.MENOR`, borrador/activar/archivar, unassign duro de preguntas). Sprint 4: **imágenes en el enunciado y en las opciones** de una pregunta, servidas desde `/uploads`. Sprint 5: **modelo de vinculación** — `Usuario` queda como identidad pura y la pertenencia (organización, rol, pares puesto+centro de costo) se mueve a `Vinculacion` / `VinculacionPuestoCentro`; la clasificación SIMA/CLIENTE/SUBCONTRATISTA/INVITADO se elimina como concepto. Además: **asignaciones automáticas** — el par (puesto, centro de costo) de una persona obliga a rendir un módulo (`ReglaAsignacion`), y `AsignacionesService.recalcular()` deriva las `Asignacion` (`AUTOMATICA`/`MANUAL`) vigentes de cada usuario. Sprint 6: **clasificación del banco** — cada `Pregunta` apunta a una `BaseConocimiento` (el tema) y a un `NivelBase` de esa base (la dificultad, con escala propia por base); reemplaza a la vieja `Etiqueta`, que se elimina. Sprint 7: **composición de módulos por criterio** — una `ModuloVersion` puede declarar *qué evalúa* (`ModuloVersionCriterio`) y el backend materializa el pool de preguntas, conviviendo con la elección manual de siempre. Sprint 8: **rendición de evaluaciones** — `Sesion` (un intento, contra una versión concreta) + `Respuesta` (una por pregunta contestada), con la corrección y el umbral persistidos; con eso `AsignacionesService.modulosAprobados()` deja de ser un hueco y `Asignacion.moduloVersionId` se completa al aprobar.

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
| `TABLET_LOGIN_SIN_PIN` | Login de la tablet sin PIN (default `'true'`; `501` en `'false'`) — ver [`docs/autenticacion-tablet.md`](docs/autenticacion-tablet.md) |
| `TABLET_JWT_EXPIRES_IN` | Vigencia del token de la tablet (default `2h`, corta a propósito: es un atril compartido, no el dispositivo de una sola persona) |

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
| `GET` | `/usuarios/:id/audit-log` | — | Historial de auditoría de esta persona (`Vinculacion` + sus pares), más reciente primero, sin paginar (Story 9) |
| `GET` | `/usuarios/:id/informe` | — | **Hoja de vida** de esta persona en un solo request (Story 10): `{ usuario, veredicto, asignaciones, sesiones, auditLog }`. `veredicto` es `{ estado, asignacion }` con el estado de habilitación calculado en el backend (ver las decisiones de diseño); `asignaciones` es lo mismo que devuelve `GET /asignaciones?usuarioId=` (con su `vencimiento` por fila), `sesiones` son **todas** las rendiciones —aprobadas y no— más recientes primero, y `auditLog` es lo mismo que `/audit-log`. 404 si el usuario no existe o está dado de baja. Sin paginar ninguna de las tres listas |
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
| `GET` | `/asignaciones` | — | Lista las asignaciones (vigentes y revocadas) de una persona, `?usuarioId=`. Cada una trae `vencimiento: { estado, aprobadaEn, venceEl }` (Story 8), calculado igual para revocadas |
| `POST` | `/asignaciones` | JWT | Alta MANUAL de una asignación puntual. 409 si ya hay una vigente de ese módulo para esa persona (índice único parcial) |
| `POST` | `/asignaciones/recalcular/:usuarioId` | JWT | Deriva las AUTOMATICA a partir de los pares (puesto, centro) activos y las reglas vigentes: crea las que faltan y revoca las que ya no corresponden. Nunca toca las MANUAL. Devuelve `{ creadas, revocadas }`. **Los dos caminos normales ya lo disparan solos**: editar los pares de una persona (`UsuariosService`) y tocar una regla de su centro (`ReglasAsignacionService`), los dos dentro de su propia transacción. Queda como reconciliación manual para lo que ninguno de los dos cubre — ojo que **no** cubre dar de baja un `Puesto`/`CentroCosto` del catálogo: el motor no mira `Puesto.activo`, así que ahí este endpoint tampoco cambia nada |
| `PATCH` | `/asignaciones/:id/revocar` | JWT | Revoca una asignación (nunca se borra). Idempotente |
| `GET` | `/reglas-asignacion` | — | Lista reglas, filtros `?puestoId=`/`?centroCostoId=`/`?moduloId=`/`?activo=`/`?alcance=PUESTO\|CENTRO`. `?puestoId=` es **literal**: trae sólo las de ese puesto, no las de centro |
| `POST` | `/reglas-asignacion` | JWT | Alta de una regla. Con `puestoId` → regla por par exacto; **sin `puestoId` → regla de CENTRO** (aplica a todos los puestos de ese centro). Si la misma regla ya existe dada de baja **o eliminada**, reactiva/revive esa misma fila en vez de duplicar |
| `PATCH` | `/reglas-asignacion/:id` | JWT | `{ moduloId?, activo? }`, al menos uno. `activo` es la pausa reversible; `moduloId` corrige a qué módulo obliga la regla. **El alcance (puesto/centro) no se edita**: moverla de lugar es eliminarla y crear otra. Ojo: el backoffice **sólo manda `activo`** — `moduloId` está implementado y testeado pero hoy no tiene consumidor (la pantalla Reglas edita por diff alta+baja, para que el módulo anterior quede registrado; ver `CLAUDE.md`) |
| `DELETE` | `/reglas-asignacion/:id` | JWT | Elimina la regla: **baja lógica** (`deletedAt`), la fila nunca se borra — es la única evidencia de por qué alguien tuvo que rendir un módulo. Eje distinto de `activo`: deja de listarse y de matchear, y no hay filtro para verla desde el backoffice. Volver a crear el mismo triple **revive esta misma fila** |
| `POST` | `/tablet/login` | — | Login de la app tablet: sólo `dni`. **PROVISIONAL sin PIN**, gateado por `TABLET_LOGIN_SIN_PIN` (`501` si está en `'false'` — ver [`docs/autenticacion-tablet.md`](docs/autenticacion-tablet.md)). Devuelve `access_token` (JWT con `tipo: 'alumno'`, distinto del backoffice) + `{ id, nombre, apellido }` |
| `GET` | `/tablet/pendientes` | JWT alumno | Asignaciones vigentes del usuario del token que todavía no aprobó. Excluye módulos `activo: false` y sin ninguna versión `ACTIVO` publicada |
| `GET` | `/tablet/modulos/:moduloId/examen` | JWT alumno | Resuelve la versión `ACTIVO` del módulo y sortea `PREGUNTAS_POR_EXAMEN` preguntas activas (pivot **y** pregunta). `respuestaCorrecta` nunca sale del `select` de Prisma |
| `POST` | `/tablet/sesiones` | JWT alumno | Registra el resultado de una rendición — delega en `SesionesService.registrar()`. El `usuarioId` sale del token, nunca del body. `201` si crea la sesión, `200` si deduplica por `claveIdempotencia` |

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
│                    la matriz tipo-de-organización ↔ rol, compartida con el import.
│                    De acá cuelgan también los dos endpoints por persona que no
│                    son ABM: /audit-log (Story 9) y /informe (Story 10, agrega
│                    asignaciones + sesiones + auditoría + veredicto)
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
│                    AsignacionesService.recalcular() (deriva las AUTOMATICA).
│                    Dos módulos de funciones puras: vigencia.ts (cuándo vence una
│                    aprobación) y veredicto.ts (Story 10: el estado de habilitación
│                    de una persona, agregando el vencimiento de sus asignaciones)
├── sesiones/        Sesion (un intento de rendición) + Respuesta (una por pregunta
│                    contestada) + corregir.ts (funciones puras: umbral y corrección).
│                    listarPorUsuario() devuelve TODAS las rendiciones de una
│                    persona (aprobadas y no) para el informe de la Story 10
├── tablet/          Namespace HTTP de la app tablet (Story 5): login de alumno
│                    (JWT propio, `tipo: 'alumno'`) + TabletAuthGuard + los tres
│                    endpoints (pendientes/examen/registrar resultado). Delega la
│                    corrección y la idempotencia en SesionesService, no las
│                    reimplementa — sorteo.ts es la única lógica propia (sortear
│                    N preguntas del pool, función pura)
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
│                    ReglaAsignacion, Asignacion, Sesion, Respuesta + pivots
├── seed.ts          Organización interna (Ingeniería SIMA) + módulos base, y el
│                    escenario de demo detrás de SEED_DEMO=true.
│                    Limpia en orden de dependencia (las FK son ON DELETE RESTRICT)
└── migrations/      Migraciones versionadas
```

## Despliegue (pendiente)

`Dockerfile` y `render.yaml` están preparados pero **no activos**. Para desplegar a la nube hay que crear la cuenta en Render/Railway y conectar el repo — ver comentarios en [`render.yaml`](render.yaml). El CI (`.github/workflows/ci-sima-training.yml`) corre lint + build + test + un smoke test de `start:prod` (levanta el server contra un Postgres real del job y verifica `/health`), sin paso de deploy todavía.

**Storage al deployar**: va object storage (S3 o Cloudflare R2), no disco persistente — el plan free de Render no ofrece discos, y el contenedor es efímero (cada redeploy borraría `UPLOADS_DIR` con `LocalDiskStorage`). Falta escribir la implementación nueva de `StorageService` (ver `docs/pendientes.md`); el storage está detrás de una interfaz chica así que no toca schema, controllers ni frontend.

## Decisiones de diseño — [`../docs/decisiones/`](../docs/decisiones/)

**El porqué de cada decisión vive en `docs/decisiones/`, un archivo por dominio.** Este README describe cómo correr el proyecto, los endpoints y la estructura; allá está por qué está armado así, qué alternativas se descartaron y qué costos se aceptaron.

Están organizadas **por dominio y no por sprint**: el orden cronológico sólo le sirve a quien vivió los sprints, y alguien que abre `asignaciones.service.ts` quiere el porqué de ese archivo, no un recorrido por ocho sprints.

| Archivo | Qué contiene |
|---|---|
| [usuarios.md](../docs/decisiones/usuarios.md) | `Usuario` como identidad pura, `Vinculacion`, los pares puesto+centro, la matriz tipo-de-organización ↔ rol y el import de nómina |
| [preguntas.md](../docs/decisiones/preguntas.md) | El banco: `Pregunta`, sus dos bajas lógicas, las imágenes, la detección de duplicados y la clasificación en bases y niveles |
| [modulos.md](../docs/decisiones/modulos.md) | `Modulo` y `ModuloVersion` (versionado inmutable), el pivot con sus dos orígenes, los criterios y el editor de contenido |
| [asignaciones.md](../docs/decisiones/asignaciones.md) | `ReglaAsignacion` y `Asignacion`, el motor `recalcular()`, la vigencia de las aprobaciones y el veredicto de habilitación |
| [sesiones.md](../docs/decisiones/sesiones.md) | `Sesion` y `Respuesta`: la rendición, la corrección, el umbral congelado y la idempotencia |
| [tablet.md](../docs/decisiones/tablet.md) | El namespace HTTP `/tablet`, la autenticación de alumno y la PWA de `sima-check-app` |
| [auditoria.md](../docs/decisiones/auditoria.md) | `AuditLog`: qué se audita, por qué un diff y no un snapshot, y por qué la tabla es polimórfica |
| [infraestructura.md](../docs/decisiones/infraestructura.md) | Storage, deploy, el seed con su orden de borrado, y las constraints que Prisma no conoce |

Al agregar una decisión nueva va en el archivo de su dominio, **no acá**; al cambiar una, se reescribe la sección en vez de apilar una nueva.
