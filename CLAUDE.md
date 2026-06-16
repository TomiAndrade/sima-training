# TRAINING — SIMA TRAINING Platform

## Qué es esto

MVP navegable de alta fidelidad para validar la plataforma **SIMA TRAINING** de **Ingeniería Sima** ante clientes de la industria Oil & Gas. No tiene backend ni base de datos — todos los datos son mockeados. Sirve como demo comercial y base para evolucionar hacia producción.

**SIMA CHECK** (capacitaciones y evaluaciones industriales) es el primer producto integrado en la plataforma. La arquitectura está preparada para incorporar productos futuros (SIMA INSPECTIONS, SIMA AUDITS, etc.) sin reorganizaciones.

## Dos proyectos independientes

| Proyecto | Descripción | Puerto dev |
|---|---|---|
| `sima-training-backoffice/` | Backoffice de la plataforma SIMA TRAINING | 5173 |
| `sima-check-app/` | App de evaluación para tablets industriales (producto SIMA CHECK) | 5174 |

## Stack técnico

Ambos proyectos usan el mismo stack:
- **Vite + React** (template react)
- **Tailwind CSS v3** + PostCSS + Autoprefixer
- Sin router (navegación con `useState`)
- Sin backend, sin API, sin base de datos

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

## Paleta de colores

Identidad visual de Ingeniería Sima: **rojo y blanco** sobre fondo oscuro industrial.

- Acento principal: `red-600`
- Fondos: `slate-950` / `slate-900` / `slate-800`
- Estados: `emerald-500` (aprobado) · `red-600` (desaprobado/peligro)

## Modelo de dominio

### Core Platform — entidades compartidas por toda la plataforma

| Entidad | Archivo | Campos |
|---|---|---|
| `Company` | `core/data/companies.js` | `id, name, active` |
| `User` | `core/data/users.js` | `id, name, role, companyId` |
| `Employee` | `core/data/employees.js` | `id, dni, name, companyId` |

### SIMA CHECK — entidades del producto de capacitaciones

| Entidad | Archivo | Campos |
|---|---|---|
| `TrainingModule` | `sima-check/data/training-modules.js` | `id, name, active, questions[]` |
| `TrainingAssignment` | `sima-check/data/training-assignments.js` | `id, employeeId, moduleId, assignedBy, assignedAt, status` |
| `Evaluation` | `sima-check/data/evaluations.js` | `id, employeeName, moduleName, score, approved, date, companyId` |

`status` admite: `'pending' | 'completed' | 'expired'`

## Modelo de roles

| Rol | Acceso |
|---|---|
| `administrador` | Backoffice completo: empresas, usuarios, módulos, preguntas, asignaciones, métricas globales |
| `coordinador` | Backoffice limitado: asignaciones de su empresa, empleados de su empresa |
| Empleado | Solo App SIMA CHECK (acceso por DNI) |

## Backoffice — pantallas y navegación

### Dashboard
KPIs (empresas activas, usuarios, módulos, % aprobación, asignaciones pendientes, asignaciones completadas) + gráfico SVG de barras por módulo + tabla de últimas evaluaciones.

### Administración (Core)
- **Empresas** — tabla + modal crear/editar + toggle activo/inactivo
- **Usuarios** — tabla + modal crear/editar con roles (administrador/coordinador)

### SIMA CHECK
- **Capacitaciones** — tabla + modal crear/editar + toggle activo/inactivo
- **Preguntas** — tabla filtrable por módulo + modal crear/editar (soporte V/F y opción múltiple)
- **Asignaciones** — tabla (empleado, empresa, módulo, estado, asignado por, fecha) + modal crear con validación de duplicados

### Configuración *(placeholder)*
Sección visible en el sidebar — Roles y Permisos se agregarán en el futuro.

Layout: sidebar fijo con secciones agrupadas + header + contenido principal.

## App SIMA CHECK — flujo

1. **Ingreso por DNI** — campo numérico, botón Ingresar, validaciones (vacío / no encontrado)
2. **Capacitaciones pendientes** — muestra nombre y empresa del empleado + solo los módulos con `assignment.status === 'pending'`; estado vacío si no hay pendientes
3. **Evaluación** — 3 preguntas aleatorias del módulo, barra de progreso, opciones táctiles grandes
4. **Resultado** — score %, badge APROBADO (≥70%) / DESAPROBADO (<70%), botones: Mis capacitaciones / Reintentar / Volver al inicio

Al finalizar una evaluación la asignación correspondiente cambia de `pending → completed` en el estado de la sesión. La pantalla de módulos se actualiza automáticamente.

## Datos mockeados

- **Empresas**: YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy
- **Usuarios**: 8 usuarios con roles `administrador` o `coordinador`
- **Empleados**: 15 empleados con `id`, `dni`, `name`, `companyId` (y `company` para display en la app)
- **Módulos de capacitación**: 4 módulos, ~10 preguntas cada uno (incluye preguntas reales de SIMA Avanzado)
- **Evaluaciones**: 20 registros históricos para el dashboard del backoffice
- **Asignaciones**: 25 asignaciones mockeadas con `status: 'pending' | 'completed' | 'expired'`

Las preguntas reales están en `sima-check/data/training-modules.js` del backoffice y `src/data/modules.js` de la app (módulo SIMA Avanzado, IDs 301–310).

## Arquitectura de archivos

```
sima-check-backoffice/src/
├── core/
│   ├── data/          companies.js · users.js · employees.js
│   └── pages/         Companies.jsx · Users.jsx
├── sima-check/
│   ├── data/          training-modules.js · training-assignments.js · evaluations.js
│   └── pages/         TrainingModules.jsx · Questions.jsx · TrainingAssignments.jsx
├── pages/             BackofficeLayout.jsx · Dashboard.jsx
├── components/        Button · Card · Modal · Table · StatCard · ProgressBar
└── hooks/             useNavigation.js

sima-check-app/src/
├── data/              employees.js · modules.js · assignments.js
├── components/        Button · ProgressBar · QuestionCard
├── hooks/             useNavigation.js
├── utils/             evaluation.js (pickRandomQuestions, calculateScore)
└── pages/             EmployeeSelection · ModuleSelection · Evaluation · Results
```

## Decisiones de arquitectura

- No se usa react-router intencionalmente.
- No existe persistencia entre sesiones — todo es estado local en React.
- **Regla de dependencia**: `sima-check/` puede importar de `core/`. `core/` nunca importa de `sima-check/`. `Dashboard` puede importar de ambos.
- El estado de `assignments` se eleva a `App.jsx` en la app tablet para permitir actualizaciones reactivas durante la sesión.
- Los modales manejan estado local.
- Los gráficos son SVG puro (sin librerías).
- Tailwind v3 es obligatorio.
- El campo `company` (string) se mantiene en el empleado de la app junto a `companyId` para evitar importar `companies.js` en la app tablet.

## Cómo agregar un producto futuro (ej: SIMA INSPECTIONS)

1. Crear `src/sima-inspections/data/` con sus entidades.
2. Crear `src/sima-inspections/pages/` con sus pantallas.
3. Agregar una nueva sección en `NAV_SECTIONS` de `BackofficeLayout.jsx`.
4. Registrar las páginas nuevas en `PAGES` de `App.jsx`.
