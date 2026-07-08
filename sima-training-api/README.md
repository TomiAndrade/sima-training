# SIMA Training API

Backend de la plataforma **SIMA Training** — NestJS + PostgreSQL + Prisma.

Expone la API que consumen los frontends existentes (`sima-training-backoffice` y, a futuro, `sima-check-app`). Sprint 1: ABM de **Usuarios** y **Organizaciones** sobre datos reales, autenticación básica JWT y esqueleto de importación de Excel. Sprint 2: banco de **Preguntas** y **Módulos versionados** de SIMA CHECK, y clasificación de usuarios (SIMA/CLIENTE/SUBCONTRATISTA/INVITADO).

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

# 5. Cargar datos de prueba (fixtures del prototipo)
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
| `POST` | `/auth/login` | — | Login, devuelve `access_token` |
| `GET` | `/usuarios` | — | Lista paginada (`?page=`, `?limit=`, default 1/50), filtro `?clasificacion=`, incluye `organizacion`, orden `created_at` desc. Responde `{ data, total, page, limit }` |
| `POST` | `/usuarios` | JWT | Alta (rechaza DNI duplicado con 409; revive si el DNI pertenece a un usuario dado de baja) |
| `GET` | `/usuarios/:id` | — | Detalle |
| `PATCH` | `/usuarios/:id` | JWT | Edición |
| `DELETE` | `/usuarios/:id` | JWT | Baja lógica (soft-delete) |
| `GET` | `/organizaciones` | — | Lista organizaciones |
| `POST` | `/organizaciones` | JWT | Alta (cliente o subcontratista) |
| `GET` | `/organizaciones/:id` | — | Detalle |
| `PATCH` | `/organizaciones/:id` | JWT | Edición |
| `POST` | `/import/usuarios/preview` | JWT | Preview de un `.xlsx` (no persiste) |
| `POST` | `/import/usuarios/confirm` | JWT | Importa y persiste los usuarios del `.xlsx` |
| `POST` | `/import/preguntas/preview` | JWT | Preview de un `.xlsx` de preguntas: clasifica cada fila como nueva/duplicada/parecida contra el banco (ver detección de similitud más abajo) |
| `POST` | `/import/preguntas/confirm` | JWT | Crea las preguntas ya elegidas por el usuario en el preview (body JSON, no re-sube el archivo); `moduloId?` opcional para asignarlas en el mismo gesto |
| `POST` | `/etiquetas` | JWT | Alta (rechaza nombre duplicado con 409) |
| `GET` | `/etiquetas` | — | Lista todas |
| `POST` | `/preguntas` | JWT | Alta, con `etiquetaIds?` opcionales |
| `GET` | `/preguntas` | — | Lista, filtros `?q=` (texto), `?etiqueta=`, `?categoria=`, `?activa=` (papelera global si `false`), `?moduloId=` (repetible, OR entre sí), `?sinAsignar=true` (OR con `moduloId`). Cada pregunta trae `modulos: [{moduloId, moduloNombre, activaEnModulo}]` con sus asignaciones vigentes |
| `GET` | `/preguntas/:id` | — | Detalle |
| `PATCH` | `/preguntas/:id` | JWT | Papelera global: `{ activa: false }` desactiva la pregunta y cascadea `activa=false` a todas sus asignaciones por módulo; `{ activa: true }` la recupera pero **no** restaura los pivots (el admin reactiva módulo por módulo) |
| `GET` | `/modulos` | — | Lista todos los módulos (`id, nombre, descripcion`) |
| `POST` | `/modulos` | JWT | Crea el módulo y su `ModuloVersion` v1 en BORRADOR |
| `GET` | `/modulos/:id` | — | Módulo + versión activa (o la última) + sus preguntas (activas e inactivas) |
| `GET` | `/modulos/:id/versiones` | — | Lista todas las versiones del módulo |
| `POST` | `/modulos/:id/preguntas` | JWT | Asigna preguntas existentes a la versión BORRADOR (array `{ preguntaId, orden, obligatoria? }`; 409 si ya está asignada, 404 si la pregunta no existe) |
| `PATCH` | `/modulos/:id/preguntas/:preguntaId` | JWT | Activa/desactiva la asignación de una pregunta **en ese módulo** (baja lógica por módulo, distinta de la papelera global de `/preguntas/:id`) |

Las **lecturas** (`GET`) son abiertas; las **escrituras** requieren `Authorization: Bearer <token>`.

## Estructura del proyecto

```
src/
├── auth/            Login JWT + guard (sin roles, Sprint 1)
├── usuarios/        ABM de Usuario (identidad única de cualquier persona)
├── organizaciones/  ABM de Organizacion (cliente/subcontratista, jerarquía)
├── import/          Importación de nómina y de preguntas desde Excel (exceljs)
│                    + similitud.ts (detección de duplicados/parecidas, en memoria)
├── etiquetas/       CRUD de Etiqueta (categorización de preguntas)
├── preguntas/       Alta/listado de Pregunta (banco único, reutilizable entre módulos)
├── modulos/         Modulo + ModuloVersion (versionado inmutable) + asignación de preguntas
├── prisma/          PrismaService + módulo global
├── health/          Health check
├── app.module.ts
└── main.ts          ValidationPipe global + CORS
prisma/
├── schema.prisma    Usuario, Organizacion, Pregunta, Etiqueta, Modulo, ModuloVersion + pivots
├── seed.ts          Fixtures del prototipo (5 clientes, 8 usuarios)
└── migrations/      Migraciones versionadas
```

## Despliegue (pendiente)

`Dockerfile` y `render.yaml` están preparados pero **no activos**. Para desplegar a la nube hay que crear la cuenta en Render/Railway y conectar el repo — ver comentarios en [`render.yaml`](render.yaml). El CI (`.github/workflows/ci-sima-training.yml`) corre lint + build + test, sin paso de deploy todavía.

## Decisiones de diseño (Sprint 1)

- **`Usuario` es una sola entidad** para cualquier persona (cuenta de sistema y/o persona evaluada). El rol vive en `Usuario` de forma transitoria; migrará a `Vinculacion` en sprints futuros.
- **Trazabilidad** (`created_at/updated_at/created_by/updated_by`) y **soft-delete** (`deleted_at`) desde el día 1.
- **Campo `datos` (jsonb)** en `Usuario` para datos de nómina flexibles, hasta cerrar el mapeo del Excel real.
- El **mapeo de columnas del import** queda abierto a propósito hasta tener el Excel definitivo.

## Decisiones de diseño (Sprint 2 — SIMA CHECK)

- **`clasificacion` (SIMA/CLIENTE/SUBCONTRATISTA/INVITADO) es una columna persistida y editable** en `Usuario`, no derivada de `Organizacion.tipo` al vuelo. Solo aplica a `rol = ALUMNO`. Se sugiere automáticamente según el tipo de la organización elegida, pero un admin puede forzarla a mano (ej. marcar una excepción puntual como INVITADO). Se eligió este enfoque a sabiendas de que puede divergir del tipo real de la organización; si eso deja de ser deseable, migrar a derivación pura es una migración chica (columna nullable sin relaciones) mientras no haya overrides reales en uso.
- **Banco de preguntas único y reutilizable**: `Pregunta` nunca se duplica; se comparte entre módulos vía el pivot `ModuloVersionPregunta` (N a N).
- **Módulos versionados e inmutables**: `Modulo` es un contenedor estable; el contenido real vive en `ModuloVersion`. Editar un módulo activo crea una versión nueva — las versiones anteriores quedan `ARCHIVADO` y no se modifican ni se pierden.
- **Tipos de pregunta**: `VERDADERO_FALSO` / `OPCION_MULTIPLE` / `OPCIONES_IMAGEN` mapean 1:1 a `truefalse` / `multiple` / `image-options` del frontend mockeado. `TEXTO_LIBRE` se agregó al enum para uso futuro, sin implementación todavía.
- **Dos bajas lógicas distintas para `Pregunta`, no una sola**: `ModuloVersionPregunta.activa` es la baja **por módulo** (Sprint 2, no afecta otros módulos ni el banco). `Pregunta.activa` es la **papelera global** (Sprint 3): saca la pregunta de todo el banco y cascadea `activa=false` a todas sus asignaciones por módulo; recuperarla de la papelera **no** restaura esas asignaciones (asimetría intencional — el admin decide dónde reactivarla).
- **Detección de duplicados/similares: resuelto en memoria, no con pg_trgm** (`src/import/similitud.ts`). Se normaliza el texto en español (sin acentos/puntuación) y se compara por coeficiente de Dice sobre trigramas de caracteres, contra el banco completo y contra las filas del mismo archivo. Se prefirió esta vía a la extensión `pg_trgm` de Postgres porque el proyecto es local-first sin deploy cloud activo todavía, y para no atar la portabilidad a que el Postgres administrado permita `CREATE EXTENSION`; queda encapsulado en funciones puras, reemplazable el día que el banco crezca lo suficiente.
- **Importación de preguntas por Excel con preview seleccionable**: cada fila del `.xlsx` se clasifica como nueva/duplicada/parecida; el usuario elige fila por fila cuáles importar en el preview (`POST /import/preguntas/preview`), y el confirm (`POST /import/preguntas/confirm`) recibe esa selección ya armada como JSON (no vuelve a leer el archivo), con un `moduloId` de destino opcional.
- **Pendiente para el próximo sprint**: `PATCH /modulos/:id/aprobar` (flujo de aprobación de versión) y el AuditLog completo para ISO 9001.
