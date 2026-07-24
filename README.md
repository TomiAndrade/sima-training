# SIMA TRAINING — MVP

> **Estado: MVP con backend real.** El backend (NestJS + PostgreSQL) ya expone **Usuarios** (con su vinculación a organización/rol y sus pares puesto+centro de costo), **Puestos**, **Centros de Costo**, **Organizaciones**, el banco de **Preguntas**, los **Módulos** versionados y el motor de **Asignaciones automáticas** (regla puesto+centro → módulo). El backoffice ya consume 100% del backend para Usuarios, Puestos, Centros de Costo, Preguntas y Módulos; Clientes y la pantalla de Asignaciones todavía son mock. La app tablet sigue 100% mockeada, sin conexión al backend.

MVP de alta fidelidad para **Ingeniería Sima**, orientado a la industria Oil & Gas. Arquitectura multi-producto: **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado. El sistema está preparado para incorporar SIMA INSPECTIONS, SIMA AUDITS, etc.

Detalle completo (modelo de dominio, decisiones de diseño por sprint, endpoints) en [`CLAUDE.md`](CLAUDE.md). Pendientes activos en [`docs/pendientes.md`](docs/pendientes.md).

---

## Proyectos

| Proyecto | Descripción | Puerto dev |
|---|---|---|
| `sima-training-api/` | **Backend** NestJS + PostgreSQL + Prisma | 3000 |
| `sima-training-backoffice/` | Backoffice de la plataforma SIMA TRAINING | 5173 |
| `sima-check-app/` | App de evaluación para tablets industriales (SIMA CHECK) | 5174 |

Cada uno tiene su propio `package.json` y se corre de forma independiente.

---

## Stack

**Frontends** (`sima-training-backoffice`, `sima-check-app`):
- **Vite + React** (sin react-router — navegación con `useState`)
- **Tailwind CSS v3** + PostCSS + Autoprefixer

**Backend** (`sima-training-api`):
- **NestJS 11** + TypeScript (monolito modular por dominio)
- **PostgreSQL 16** (local vía Docker Compose) + **Prisma 6**
- **JWT** para auth básica (sin roles todavía)

Detalle del backend en [`sima-training-api/README.md`](sima-training-api/README.md).

---

## Cómo correr

```bash
# 1. Backend (requiere Docker Desktop corriendo)
cd TRAINING/sima-training-api
npm install
cp .env.example .env
docker compose up -d db          # PostgreSQL local
npx prisma migrate dev           # crea las tablas
npx prisma db seed               # organización interna + módulos base
npm run start:dev                # → http://localhost:3000

# 2. Backoffice
cd TRAINING/sima-training-backoffice
npm install
cp .env.example .env             # VITE_API_URL apunta al backend local
npm run dev                      # → http://localhost:5173

# 3. App tablet (mockeada, sin backend aún)
cd TRAINING/sima-check-app
npm install
npm run dev   # → http://localhost:5174
```

---

## Backoffice — navegación

Sidebar global con tres secciones:

- **Panel Principal** — vista de plataforma: KPIs operacionales, tabla de actividad reciente, estado del sistema (OPERATIVO/ADVERTENCIA), product cards
- **Administración** — Clientes · Usuarios · Puestos · Centros de Costo (Usuarios, Puestos y Centros de Costo ya consumen la API real; Clientes sigue mock)
- **Productos** — SIMA CHECK (ítem único; al entrar aparece tab bar interno)

### SIMA CHECK (tab bar interno)

| Tab | Descripción |
|---|---|
| Resumen | Métricas operacionales + gráfico SVG de aprobación por módulo + últimas evaluaciones (mock, salvo el StatCard "Módulos activos" que ya es dato real) |
| Módulos | **100% backend**: tabla de módulos contra `/modulos`, con su ciclo de vida (BORRADOR/ACTIVO/ARCHIVADO) y versionado (`AÑO.MAYOR.MENOR`) |
| Preguntas | **100% backend**: banco de preguntas contra `/preguntas`, filtros combinables por módulo/texto/papelera, asignación a módulos |
| Asignaciones | Mock (`training-assignments.js`) — el backend ya tiene el modelo real (`Asignacion`/`ReglaAsignacion`, asignación automática por par puesto+centro → módulo) pero esta pantalla todavía no lo consume |

---

## App SIMA CHECK — flujo

Todas las pantallas son tarjetas blancas (`bg-white border border-slate-200 shadow-2xl`) sobre un fondo claro con imagen de industria de fondo (modo claro, pensado para uso en exteriores Oil & Gas) — no fondo oscuro.

1. **Ingreso por DNI** — campo numérico, validación vacío / no encontrado
2. **Capacitaciones pendientes** — nombre y empresa de la persona + módulos con `status === 'pending'`
3. **Evaluación** — 3 preguntas aleatorias, barra de progreso (avanza al responder), opciones táctiles grandes; V/F con verde/rojo; opción múltiple seleccionada en oscuro; `image-options` en grid 2×2
4. **Resultado** — score %, badge APROBADO (≥70%) / DESAPROBADO (<70%), botones de acción

Al finalizar, la asignación cambia de `pending → completed` en el estado de la sesión — solo si aprueba.

---

## Datos

> **Usuarios, Organizaciones, Puestos, Centros de Costo, Preguntas y Módulos** ya viven en el backend real (PostgreSQL); el seed carga la organización interna (Ingeniería SIMA) y los módulos base, sin datos de prueba. **Clientes** y la pantalla de **Asignaciones** siguen mockeados en archivos `.js`.
>
> Una persona puede tener **varios pares** (puesto, centro de costo) y debe hacer los módulos que le corresponden por **todos** ellos — el par marcado como `principal` es solo el que se muestra en el listado. Qué roles admite cada tipo de organización lo fija una matriz (`INTERNA` → todos · `CLIENTE` → auditor · `SUBCONTRATISTA` → alumno) que el backend valida tanto en el alta manual como en el import de Excel. Detalle en [`docs/modelo-vinculacion-propuesto.md`](docs/modelo-vinculacion-propuesto.md) y en el [README del backend](sima-training-api/README.md).
>
> ⚠️ El **backoffice todavía consume la forma vieja** de `GET /usuarios` (rol plano, clasificación): migrarlo es trabajo pendiente (ver [`docs/pendientes.md`](docs/pendientes.md)).

| Entidad | Origen | Detalle |
|---|---|---|
| Clientes | Mock en backoffice (el backend ya modela `Organizacion` tipo CLIENTE, pero la pantalla no la consume) | YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy |
| Usuarios | **Backend** (API real) | `Usuario` es **identidad pura** (nombre, apellido, DNI, email). La pertenencia vive en `Vinculacion` — una por usuario, con **organización y rol** (`ADMINISTRADOR` · `COORDINADOR` · `AUDITOR` · `ALUMNO`) — y el par **puesto + centro de costo** en `VinculacionPuestoCentro` |
| Puestos / Centros de Costo | **Backend** (API real) | Catálogos de nómina, baja lógica con `activo` |
| Preguntas | **Backend** (API real) | Banco único y reutilizable entre módulos, con detección de duplicados/similares en el import de Excel |
| Módulos | **Backend** (API real) | Versionados e inmutables (`ModuloVersion`, numeración `AÑO.MAYOR.MENOR`). El mock `training-modules.js` sobrevive solo para metadata liviana en pantallas que no migraron (Dashboard, Resumen, Asignaciones) |
| Asignaciones | Mock en backoffice (el backend ya modela `Asignacion`/`ReglaAsignacion`, ver arriba) | 27 asignaciones con `status: pending \| completed \| expired` |
| Evaluaciones | Mock | 20 registros históricos, para el dashboard |
| `UsuarioMock` (persona evaluada) | Mock (`usuarios-mock.js`) | 15 personas con DNI, nombre y cliente — consumido por Dashboard y Asignaciones, no confundir con el `Usuario` real del backend |

---

## Estructura de archivos

```
sima-training-api/                # Backend NestJS
├── prisma/         schema.prisma · seed.ts · migrations/
└── src/            auth/ · usuarios/ · organizaciones/ · puestos/ · centros-costo/
                    · etiquetas/ · preguntas/ · modulos/ · asignaciones/ · import/
                    · storage/ · prisma/ · health/

sima-training-backoffice/src/
├── core/
│   ├── api/        client.js · usuarios.js · organizaciones.js · puestos.js ·
│   │               centrosCosto.js · preguntas.js · modulos.js · etiquetas.js  # capa HTTP
│   ├── data/       clients.js · users.js · usuarios-mock.js (mock, en migración)
│   └── pages/      Clients.jsx · Usuarios.jsx · Puestos.jsx · CentrosCosto.jsx
│                   (Usuarios/Puestos/CentrosCosto ya usan la API real)
├── sima-check/
│   ├── data/       training-modules.js · training-assignments.js · evaluations.js (mock)
│   └── pages/      Overview.jsx · TrainingModules.jsx (backend) · Questions.jsx (backend)
│                   · TrainingAssignments.jsx (mock)
├── pages/          BackofficeLayout.jsx · Dashboard.jsx
├── components/     Button · Card · Modal · Table · StatCard · ProgressBar · MultiSelectFilter
└── hooks/          useNavigation.js

sima-check-app/src/
├── data/           usuarios.js · modules.js · assignments.js
├── components/     Button · ProgressBar · QuestionCard
├── hooks/          useNavigation.js
├── utils/          evaluation.js (pickRandomQuestions, calculateScore)
└── pages/          UsuarioSelection · ModuleSelection · Evaluation · Results
```

---

## Paleta de colores

| Contexto | Uso | Clase |
|---|---|---|
| Backoffice | Fondos | `zinc-950` / `zinc-900` / `zinc-800` |
| Backoffice | Acento | `red-600` |
| App tablet | Fondo | Imagen de industria (`SIMACHECK-FONDO.png`), modo **claro** |
| App tablet | Cards | `bg-white` / texto `slate-900` (principal) · `slate-500` (secundario) |
| Ambos | Aprobado | `emerald-500` |
| Ambos | Desaprobado / peligro / acento | `red-600` |
