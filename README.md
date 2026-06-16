# SIMA TRAINING — MVP

> **Estado: MVP de demostración.** Sin backend ni base de datos. Todos los datos son mockeados. Sirve para validar la plataforma ante clientes y como base para evolucionar a producción.

MVP navegable de alta fidelidad para **Ingeniería Sima**, orientado a la industria Oil & Gas. Arquitectura multi-producto: **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado. El sistema está preparado para incorporar SIMA INSPECTIONS, SIMA AUDITS, etc.

---

## Proyectos

| Proyecto | Descripción | Puerto dev |
|---|---|---|
| `sima-training-backoffice/` | Backoffice de la plataforma SIMA TRAINING | 5173 |
| `sima-check-app/` | App de evaluación para tablets industriales (SIMA CHECK) | 5174 |

Cada uno tiene su propio `package.json` y se corre de forma independiente.

---

## Stack

- **Vite + React** (sin react-router — navegación con `useState`)
- **Tailwind CSS v3** + PostCSS + Autoprefixer
- Sin backend, sin API, sin base de datos

---

## Cómo correr

```bash
# Backoffice
cd TRAINING/sima-training-backoffice
npm install
npm run dev   # → http://localhost:5173

# App tablet
cd TRAINING/sima-check-app
npm install
npm run dev   # → http://localhost:5174
```

---

## Backoffice — navegación

Sidebar global con tres secciones:

- **Panel Principal** — vista de plataforma: KPIs operacionales, tabla de actividad reciente, estado del sistema (OPERATIVO/ADVERTENCIA), product cards
- **Administración** — Empresas · Usuarios
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

## Datos mockeados

| Entidad | Detalle |
|---|---|
| Empresas | YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy |
| Usuarios | 8 usuarios con roles `administrador` o `coordinador` |
| Empleados | 15 empleados con DNI, nombre y empresa |
| Módulos | 4 módulos, ~10 preguntas cada uno (incluye preguntas reales de SIMA Avanzado) |
| Evaluaciones | 20 registros históricos |
| Asignaciones | 25 asignaciones con `status: pending \| completed \| expired` |

---

## Estructura de archivos

```
sima-training-backoffice/src/
├── core/
│   ├── data/       companies.js · users.js · employees.js
│   └── pages/      Companies.jsx · Users.jsx
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
