# SIMA Training API

Backend de la plataforma **SIMA Training** — NestJS + PostgreSQL + Prisma.

Expone la API que consumen los frontends existentes (`sima-training-backoffice` y, a futuro, `sima-check-app`). Sprint 1: ABM de **Usuarios** y **Organizaciones** sobre datos reales, autenticación básica JWT y esqueleto de importación de Excel.

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

## Endpoints (Sprint 1)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/health` | — | Estado del servicio |
| `POST` | `/auth/login` | — | Login, devuelve `access_token` |
| `GET` | `/usuarios` | — | Lista usuarios (excluye dados de baja) |
| `POST` | `/usuarios` | JWT | Alta (rechaza DNI duplicado con 409) |
| `GET` | `/usuarios/:id` | — | Detalle |
| `PATCH` | `/usuarios/:id` | JWT | Edición |
| `DELETE` | `/usuarios/:id` | JWT | Baja lógica (soft-delete) |
| `GET` | `/organizaciones` | — | Lista organizaciones |
| `POST` | `/organizaciones` | JWT | Alta (cliente o subcontratista) |
| `GET` | `/organizaciones/:id` | — | Detalle |
| `PATCH` | `/organizaciones/:id` | JWT | Edición |
| `POST` | `/import/usuarios/preview` | JWT | Preview de un `.xlsx` (no persiste) |

Las **lecturas** (`GET`) son abiertas; las **escrituras** requieren `Authorization: Bearer <token>`.

## Estructura del proyecto

```
src/
├── auth/            Login JWT + guard (sin roles, Sprint 1)
├── usuarios/        ABM de Usuario (identidad única de cualquier persona)
├── organizaciones/  ABM de Organizacion (cliente/subcontratista, jerarquía)
├── import/          Esqueleto de importación de nómina (Excel)
├── prisma/          PrismaService + módulo global
├── health/          Health check
├── app.module.ts
└── main.ts          ValidationPipe global + CORS
prisma/
├── schema.prisma    Modelos Usuario y Organizacion
├── seed.ts          Fixtures del prototipo (5 empresas, 8 usuarios)
└── migrations/      Migraciones versionadas
```

## Despliegue (pendiente)

`Dockerfile` y `render.yaml` están preparados pero **no activos**. Para desplegar a la nube hay que crear la cuenta en Render/Railway y conectar el repo — ver comentarios en [`render.yaml`](render.yaml). El CI (`.github/workflows/ci-sima-training.yml`) corre lint + build + test, sin paso de deploy todavía.

## Decisiones de diseño (Sprint 1)

- **`Usuario` es una sola entidad** para cualquier persona (cuenta de sistema y/o persona evaluada). El rol vive en `Usuario` de forma transitoria; migrará a `Vinculacion` en sprints futuros.
- **Trazabilidad** (`created_at/updated_at/created_by/updated_by`) y **soft-delete** (`deleted_at`) desde el día 1.
- **Campo `datos` (jsonb)** en `Usuario` para datos de nómina flexibles, hasta cerrar el mapeo del Excel real.
- El **mapeo de columnas del import** queda abierto a propósito hasta tener el Excel definitivo.
