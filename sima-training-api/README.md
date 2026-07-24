# SIMA Training API

Backend de la plataforma **SIMA Training** — NestJS + PostgreSQL + Prisma.

Expone la API que consumen los frontends existentes (`sima-training-backoffice` y, a futuro, `sima-check-app`). Sprint 1: ABM de **Usuarios** y **Organizaciones** sobre datos reales, autenticación básica JWT y esqueleto de importación de Excel. Sprint 2: banco de **Preguntas** y **Módulos versionados** de SIMA CHECK. Sprint 3: **versionado real de módulos** (`ModuloVersion` con numeración pública `AÑO.MAYOR.MENOR`, borrador/activar/archivar, unassign duro de preguntas). Sprint 4: **imágenes en el enunciado y en las opciones** de una pregunta, servidas desde `/uploads`. Sprint 5: **modelo de vinculación** — `Usuario` queda como identidad pura y la pertenencia (organización, rol, pares puesto+centro de costo) se mueve a `Vinculacion` / `VinculacionPuestoCentro`; la clasificación SIMA/CLIENTE/SUBCONTRATISTA/INVITADO se elimina como concepto. Además: **asignaciones automáticas** — el par (puesto, centro de costo) de una persona obliga a rendir un módulo (`ReglaAsignacion`), y `AsignacionesService.recalcular()` deriva las `Asignacion` (`AUTOMATICA`/`MANUAL`) vigentes de cada usuario.

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
| `npx prisma db seed` | Carga los fixtures |
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
| `POST` | `/import/usuarios/preview` | JWT | Preview de un `.xlsx` (no persiste) |
| `POST` | `/import/usuarios/confirm` | JWT | Importa y persiste los usuarios del `.xlsx`. Columna `rol` opcional (default `ALUMNO`); la empresa de cada fila tiene que resolver a una organización existente (o mandarse `organizacionId` como default), y la matriz tipo-de-organización ↔ rol se valida fila por fila |
| `POST` | `/import/preguntas/preview` | JWT | Preview de un `.xlsx` de preguntas: clasifica cada fila como nueva/duplicada/parecida contra el banco (ver detección de similitud más abajo) |
| `POST` | `/import/preguntas/confirm` | JWT | Crea las preguntas ya elegidas por el usuario en el preview (body JSON, no re-sube el archivo); `moduloId?` opcional para asignarlas en el mismo gesto |
| `POST` | `/etiquetas` | JWT | Alta (rechaza nombre duplicado con 409) |
| `GET` | `/etiquetas` | — | Lista todas |
| `POST` | `/puestos` | JWT | Alta (rechaza nombre duplicado con 409) |
| `GET` | `/puestos` | — | Lista todos |
| `PATCH` | `/puestos/:id` | JWT | Edición (nombre y/o `activo`, baja lógica) |
| `POST` | `/centros-costo` | JWT | Alta (rechaza nombre duplicado con 409) |
| `GET` | `/centros-costo` | — | Lista todos |
| `PATCH` | `/centros-costo/:id` | JWT | Edición (nombre y/o `activo`, baja lógica) |
| `POST` | `/preguntas` | JWT | Alta, con `etiquetaIds?` opcionales. No corre detección de duplicados/similares (eso solo pasa en el preview del import de Excel) |
| `POST` | `/preguntas/imagen` | JWT | Sube la imagen de un enunciado u opción (multipart `file`, máx 2 MB, formato detectado por magic bytes). Devuelve `{ imagen: "preguntas/<uuid>.png" }` para mandar en el `imagen` del alta |
| `DELETE` | `/preguntas/imagen/:clave` | JWT | Borra una imagen huérfana (clave url-encoded). 409 si alguna pregunta la sigue referenciando (enunciado u opción) |
| `GET` | `/preguntas` | — | Lista, filtros `?q=` (texto), `?etiqueta=`, `?categoria=`, `?activa=` (papelera global si `false`), `?moduloId=` (repetible, OR entre sí), `?sinAsignar=true` (OR con `moduloId`). Cada pregunta trae `modulos: [{moduloId, moduloNombre, activaEnModulo}]` con sus asignaciones vigentes |
| `GET` | `/preguntas/:id` | — | Detalle |
| `PATCH` | `/preguntas/:id` | JWT | Papelera global: `{ activa: false }` desactiva la pregunta y cascadea `activa=false` a todas sus asignaciones por módulo (solo en versiones BORRADOR/ACTIVO, nunca ARCHIVADO); `{ activa: true }` la recupera pero **no** restaura los pivots (el admin reactiva módulo por módulo) |
| `GET` | `/modulos` | — | Lista todos los módulos con `vigente: {estado, anio, mayor, menor}` y `borradorId` si hay un borrador en curso |
| `POST` | `/modulos` | JWT | Crea el módulo y su `ModuloVersion` v1 en BORRADOR |
| `GET` | `/modulos/:id` | — | Módulo + versión activa (o la última) + sus preguntas (activas e inactivas) |
| `PATCH` | `/modulos/:id` | JWT | Edita metadata del módulo (`nombre`/`descripcion`) |
| `GET` | `/modulos/:id/versiones` | — | Historial de versiones (más reciente primero), con `preguntasCount` por versión |
| `GET` | `/modulos/:id/versiones/:versionId` | — | Detalle de una versión puntual (incluye ARCHIVADO) + sus preguntas |
| `POST` | `/modulos/:id/versiones` | JWT | Crea un borrador nuevo copiando los pivots de preguntas del ACTIVO. Rechaza si ya hay un borrador en curso o si no hay ACTIVO del cual partir |
| `PATCH` | `/modulos/:id/activar` | JWT | Publica el borrador vigente (body `{esNuevaLinea?}`, obligatorio solo si ya hay un ACTIVO del cual derivar el número). Asigna el número `AÑO.MAYOR.MENOR` y archiva el ACTIVO anterior — transaccional |
| `DELETE` | `/modulos/:id/borrador` | JWT | Descarta el borrador en curso. Si era la única versión (módulo nunca publicado), elimina el módulo entero |
| `POST` | `/modulos/:id/preguntas` | JWT | Asigna preguntas existentes a la versión BORRADOR (array `{ preguntaId, orden?, obligatoria? }` — `orden` se appendea si no viene; 409 si ya está asignada, 404 si la pregunta no existe) |
| `PATCH` | `/modulos/:id/preguntas/:preguntaId` | JWT | Activa/desactiva la asignación de una pregunta **en la versión que se edita** (baja lógica por módulo, reversible; distinta de la papelera global de `/preguntas/:id`) |
| `DELETE` | `/modulos/:id/preguntas/:preguntaId` | JWT | Unassign duro del pivot (a diferencia del toggle anterior, no reversible). Solo sobre un BORRADOR — rechaza sobre ACTIVO/ARCHIVADO |
| `GET` | `/asignaciones` | — | Lista las asignaciones (vigentes y revocadas) de una persona, `?usuarioId=` |
| `POST` | `/asignaciones` | JWT | Alta MANUAL de una asignación puntual. 409 si ya hay una vigente de ese módulo para esa persona (índice único parcial) |
| `POST` | `/asignaciones/recalcular/:usuarioId` | JWT | Deriva las AUTOMATICA a partir de los pares (puesto, centro) activos y las reglas vigentes: crea las que faltan y revoca las que ya no corresponden. Nunca toca las MANUAL. Devuelve `{ creadas, revocadas }`. **No se dispara solo** — hay que llamarlo explícitamente después de editar los pares de un usuario |
| `PATCH` | `/asignaciones/:id/revocar` | JWT | Revoca una asignación (nunca se borra). Idempotente |
| `GET` | `/reglas-asignacion` | — | Lista reglas, filtros `?puestoId=`/`?centroCostoId=`/`?moduloId=`/`?activo=` |
| `POST` | `/reglas-asignacion` | JWT | Alta de una regla (puesto + centro de costo → módulo obligatorio). Si el triple ya existe dado de baja, la reactiva en vez de duplicar |
| `PATCH` | `/reglas-asignacion/:id` | JWT | Activa/desactiva la regla (`{ activo }`). El triple puesto/centro/módulo no se edita: para cambiarlo se crea otra regla |

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
├── etiquetas/       CRUD de Etiqueta (categorización de preguntas)
├── preguntas/       Alta/listado de Pregunta (banco único, reutilizable entre módulos)
│                    + imagen de enunciado/opciones (sube/borra, StorageModule)
├── modulos/         Modulo + ModuloVersion (versionado inmutable, numeración pública
│                    AÑO.MAYOR.MENOR) + asignación de preguntas
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
│                    Puesto, CentroCosto, Pregunta, Etiqueta, Modulo, ModuloVersion,
│                    ReglaAsignacion, Asignacion + pivots
├── seed.ts          Organización interna (Ingeniería SIMA) + módulos base.
│                    Limpia en orden de dependencia (las FK son ON DELETE RESTRICT)
└── migrations/      Migraciones versionadas
```

## Despliegue (pendiente)

`Dockerfile` y `render.yaml` están preparados pero **no activos**. Para desplegar a la nube hay que crear la cuenta en Render/Railway y conectar el repo — ver comentarios en [`render.yaml`](render.yaml). El CI (`.github/workflows/ci-sima-training.yml`) corre lint + build + test, sin paso de deploy todavía.

## Decisiones de diseño (Sprint 1)

- **`Usuario` es una sola entidad** para cualquier persona (cuenta de sistema y/o persona evaluada). El rol vivió en `Usuario` de forma transitoria y ya migró a `Vinculacion` (Sprint 5).
- **Trazabilidad** (`created_at/updated_at/created_by/updated_by`) y **soft-delete** (`deleted_at`) desde el día 1.
- **Campo `datos` (jsonb)** en `Usuario` para datos de nómina flexibles, hasta cerrar el mapeo del Excel real.
- El **mapeo de columnas del import** queda abierto a propósito hasta tener el Excel definitivo.

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

- **`ReglaAsignacion` es el motor de las `Asignacion` automáticas**: el par exacto (puesto, centro de costo) —no cada eje por separado— obliga a rendir un módulo. Apunta a `Modulo` (el contenedor), no a una `ModuloVersion`: la obligación es "este módulo", la versión concreta se resuelve al rendir.
- **`Asignacion` nunca se borra, se revoca** (`revocadaAt`). Un índice único parcial (`WHERE revocada_at IS NULL`) garantiza a lo sumo una vigente por (usuario, módulo) — vive solo en la migración SQL, Prisma no lo expresa.
- **`recalcular()` es síncrono, idempotente y nunca toca las `MANUAL`.** Compara los pares activos + reglas vigentes contra las asignaciones vigentes actuales: crea las AUTOMATICA que faltan, revoca las AUTOMATICA que ya no corresponden a ningún par activo. Correrlo dos veces seguidas no duplica ni revoca de más.
- **No se dispara solo.** Hoy es un endpoint aparte (`POST /asignaciones/recalcular/:usuarioId`) — editar los pares de una persona desde `/usuarios` no lo invoca todavía (ver pendientes).
- **El registro de aprobaciones es un hueco explícito**, aislado en `AsignacionesService.modulosAprobados()` (devuelve un Set vacío hasta que exista la entidad de aprobaciones — bloqueado por la conexión de la app tablet). `moduloVersionId` en `Asignacion` queda `null` por el mismo motivo.

## Decisiones de diseño (Sprint 5 — Modelo de vinculación)

Diseño completo en [`../docs/modelo-vinculacion-propuesto.md`](../docs/modelo-vinculacion-propuesto.md).

- **`Usuario` es identidad pura; la pertenencia vive en `Vinculacion`** (una por usuario, con `usuarioId @unique`: la regla "una sola organización por persona" la verifica Postgres, no el service). `rol`, `organizacionId` y `clasificacion` salieron de `Usuario`. No hay endpoints `/vinculaciones`: la vinculación se crea y edita **anidada** en `/usuarios`, porque no tiene ciclo de vida propio.
- **Puesto y centro de costo van apareados en `VinculacionPuestoCentro`**, no como dos ejes independientes: la capacitación obligatoria depende del **par** (*"Soldador en YPF" ≠ "Soldador en PAE"*), y el mismo puesto en dos centros son dos filas. Por eso el filtro `?puestoId=&centroCostoId=` es exacto (quien ejerce ese puesto *dentro de* ese centro), y no devuelve a quien tiene los dos por separado. Solo matchea pares con `activo: true`.
- **`principal` es solo display, con el manejo mínimo.** El alumno rinde los módulos de **todos** sus pares, así que el principal no decide nada más que qué fila muestra el listado: el primer par cargado queda principal y no hay herencia automática ni promoción al desactivarlo (que se muestre un par inactivo es cosmético). Nota técnica por si algún día hace falta un swap: van **dos UPDATEs en una transacción** (bajar el viejo, subir el nuevo) — el índice único parcial `UNIQUE (vinculacion_id) WHERE principal AND activo` no es diferible y un `updateMany` único lo violaría a mitad de camino. Hoy no existe ningún flujo de swap.
- **La matriz tipo-de-organización ↔ rol se valida en el service, no en el DTO**: cruza dos tablas (rol en `Vinculacion`, tipo en `Organizacion`), así que class-validator no puede expresarla y tampoco hay CHECK constraint posible sin un trigger. `src/usuarios/matriz-rol-organizacion.ts` la expone como función pura que devuelve el motivo del rechazo o `null` — no lanza, para que el alta lo convierta en 400 y el import lo reporte como error de fila sin abortar el archivo.
- **El import de nómina no reimplementa el alta**: `ImportService.confirmarUsuarios` arma un `CreateUsuarioDto` por fila y llama a `UsuariosService.create(dto, 'import')`. Así la matriz, el revive-por-DNI y la trazabilidad son literalmente el mismo código en los dos caminos. Consecuencias: el Excel acepta una columna `rol` opcional (default `ALUMNO`) — necesaria porque una nómina de alumnos contra una organización `CLIENTE` ahora se rechaza, la matriz solo le permite `AUDITOR` —, y una fila cuya empresa no resuelve pasó de "usuario huérfano sin organización" a **error de fila**, porque `Vinculacion.organizacionId` es NOT NULL.
- **El listado no oculta a quien no tiene pares.** Las condiciones sobre `vinculacion` se agregan al `where` solo si el filtro correspondiente viene; sin filtros, aparecen también las personas con cero pares (cardinalidad válida: el pivote arranca vacío) y su `parPrincipal` viaja en `null`.
- **Un solo `include` para lista y detalle** (`USUARIO_INCLUDE`), y por lo tanto una sola forma de respuesta. Se devuelve `pares` completo además de `parPrincipal` para no tener dos contratos según el endpoint.
- **El PATCH de `pares` reemplaza el set completo, no mergea**: borra los que había y crea los de la lista, en una transacción y borrando antes de crear (por el índice único parcial de `principal`). Omitir `pares` los deja intactos.
- **El seed borra en orden de dependencia** (`VinculacionPuestoCentro` → `Vinculacion` → `Usuario`/`Organizacion`). Todas las FK son `ON DELETE RESTRICT`: el orden anterior (`usuario.deleteMany()` primero) solo funcionaba con la base sin vinculaciones.
- **Pendiente**: migrar los frontends a la forma nueva de `GET /usuarios` (hoy leen `usuario.rol` plano y la clasificación), y el ABM de pares en el form de Usuario.
