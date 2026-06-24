# SIMA TRAINING — MVP

> **Estado: MVP con backend real (Sprint 1).** El ABM de **Usuarios** del backoffice persiste contra **PostgreSQL** vía una API **NestJS**. El resto de las pantallas sigue con datos mockeados (se migran ABM por ABM). La app tablet sigue mockeada por ahora.

MVP de alta fidelidad para **Ingeniería Sima**, orientado a la industria Oil & Gas. Arquitectura multi-producto: **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado. El sistema está preparado para incorporar SIMA INSPECTIONS, SIMA AUDITS, etc.

---

## Proyectos

| Proyecto | Descripción | Puerto dev |
|---|---|---|
| `sima-training-api/` | **Backend** NestJS + PostgreSQL + Prisma (Sprint 1) | 3000 |
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
npx prisma db seed               # fixtures (5 clientes, 8 usuarios)
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
- **Administración** — Clientes · Usuarios (Usuarios ya consume la API real)
- **Productos** — SIMA CHECK (ítem único; al entrar aparece tab bar interno)

### SIMA CHECK (tab bar interno)

| Tab | Descripción |
|---|---|
| Resumen | Métricas operacionales + gráfico SVG de aprobación por módulo + últimas evaluaciones |
| Capacitaciones | Tabla de módulos + modal crear/editar + toggle activo/inactivo |
| Preguntas | Selector de módulo → tabla de preguntas + modal crear/editar (V/F y opción múltiple) |
| Asignaciones | Tabla con estado + modal crear con validación de duplicados |

---

## App SIMA CHECK — flujo

Todas las pantallas son tarjetas flotantes sobre fondo oscuro (listo para imagen de fondo real).

1. **Ingreso por DNI** — campo numérico, validación vacío / no encontrado
2. **Capacitaciones pendientes** — nombre y empresa del empleado + módulos con `status === 'pending'`
3. **Evaluación** — 3 preguntas aleatorias, barra de progreso (avanza al responder), opciones táctiles grandes; V/F con verde/rojo; opción múltiple seleccionada en blanco
4. **Resultado** — score %, badge APROBADO (≥70%) / DESAPROBADO (<70%), botones de acción

Al finalizar, la asignación cambia de `pending → completed` en el estado de la sesión.

---

## Datos

> **Usuarios** y **Organizaciones (Clientes)** ya viven en el backend real (PostgreSQL); el seed carga 5 clientes + 8 usuarios. El resto sigue mockeado en archivos `.js` y se migra ABM por ABM.

| Entidad | Origen | Detalle |
|---|---|---|
| Clientes | **Backend** (`Organizacion`, tipo CLIENTE) / mock en backoffice | YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy |
| Usuarios | **Backend** (API real) | 8 usuarios con roles `administrador` o `coordinador` |
| Empleados | Mock | 15 empleados con DNI, nombre y cliente |
| Módulos | Mock | 4 módulos, ~10 preguntas cada uno (incluye preguntas reales de SIMA Avanzado) |
| Evaluaciones | Mock | 20 registros históricos |
| Asignaciones | Mock | 25 asignaciones con `status: pending \| completed \| expired` |

---

## Estructura de archivos

```
sima-training-api/                # Backend NestJS
├── prisma/         schema.prisma · seed.ts · migrations/
└── src/            auth/ · usuarios/ · organizaciones/ · import/ · prisma/ · health/

sima-training-backoffice/src/
├── core/
│   ├── api/        client.js · usuarios.js · organizaciones.js   # capa HTTP
│   ├── data/       clients.js · users.js · employees.js (mock, en migración)
│   └── pages/      Clients.jsx · Users.jsx (Users ya usa la API real)
├── sima-check/
│   ├── data/       training-modules.js · training-assignments.js · evaluations.js
│   └── pages/      Overview.jsx · TrainingModules.jsx · Questions.jsx · TrainingAssignments.jsx
├── pages/          BackofficeLayout.jsx · Dashboard.jsx
├── components/     Button · Card · Modal · Table · StatCard · ProgressBar
└── hooks/          useNavigation.js

sima-check-app/src/
├── data/           employees.js · modules.js · assignments.js
├── components/     Button · ProgressBar · QuestionCard
├── hooks/          useNavigation.js
├── utils/          evaluation.js (pickRandomQuestions, calculateScore)
└── pages/          EmployeeSelection · ModuleSelection · Evaluation · Results
```

---

## Paleta de colores

| Contexto | Uso | Clase |
|---|---|---|
| Backoffice | Fondos | `zinc-950` / `zinc-900` / `zinc-800` |
| Backoffice | Acento | `red-600` |
| App tablet | Fondos | `slate-900` / `slate-800` |
| Ambos | Aprobado | `emerald-500` |
| Ambos | Desaprobado / peligro | `red-600` |
