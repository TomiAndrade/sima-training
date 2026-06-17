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

**Backoffice** — estética industrial/corporativa, paleta `zinc` (sin tinte azul del `slate`):
- Fondo general: `zinc-950`
- Superficies de contenido (cards, modales, tablas): `zinc-800` con bordes `zinc-700`
- Acento principal: `red-600`
- Tipografía Inter, valores técnicos en `font-mono`
- Estados: `emerald-500` (aprobado) · `red-600` (desaprobado/peligro) · `amber-500` (advertencia)

**App tablet** — modo claro, optimizado para uso en exteriores (Oil & Gas):
- Fondo general: imagen `public/SIMACHECK-FONDO.png` con `backgroundSize: cover` en `App.jsx`
- Cards: `bg-white border border-slate-200 shadow-2xl`
- Texto principal: `slate-900` · secundario: `slate-500`
- Acento: `red-600`
- Logo: siempre visible encima de la card, cargado desde `public/logo.png` en `App.jsx`

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
| `TrainingModule` | `sima-check/data/training-modules.js` | `id, name, active, questions[]` · cada pregunta: `id, type, statement, correctAnswer, options[]?, image?, approvalRate?` |
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

### Sidebar global

Tres secciones:
- **Panel Principal** → Dashboard de plataforma
- **Administración** → Empresas, Usuarios
- **Productos** → SIMA CHECK (ítem único; resaltado en cualquier sub-página del producto)

### Dashboard (Panel Principal)

Vista de plataforma con cuatro bloques:
- KPIs operacionales: empresas activas, empleados registrados, asignaciones pendientes, completadas
- Tabla de actividad reciente (mockeada): Fecha / Usuario / Acción / Detalle
- Estado del sistema: indicadores OPERATIVO (emerald) / ADVERTENCIA (amber) por servicio
- Product cards: SIMA CHECK (activo, con stats y botón de acceso) + SIMA INSPECTIONS y SIMA AUDITS (roadmap, con ETA)

### SIMA CHECK (producto)

Al navegar a cualquier página de SIMA CHECK aparece una **barra de tabs** entre el header y el contenido:

| Tab | ID de página | Descripción |
|---|---|---|
| Resumen | `sima-check-overview` | Métricas: 6 StatCards + gráfico SVG de aprobación por módulo + lista de últimas evaluaciones |
| Capacitaciones | `training-modules` | Tabla + modal crear/editar + toggle activo/inactivo |
| Preguntas | `questions` | **Paso 1:** grid de 4 cards de módulos. **Paso 2:** tabla de preguntas + modal crear/editar. El modal soporta los 3 tipos: `truefalse`, `multiple`, `image-options`. Campo "Imagen" opcional con preview. Para `image-options` las opciones son rutas de imagen con thumbnails y la respuesta correcta se selecciona con click sobre el thumbnail. Badge de tipo: sky=V/F · violet=Múltiple · amber=Imágenes. |
| Asignaciones | `training-assignments` | Tabla (empleado, empresa, módulo, estado, asignado por, fecha) + modal crear con validación de duplicados |

La barra de tabs y el breadcrumb `SIMA TRAINING › SIMA CHECK › {tab}` se renderizan en `BackofficeLayout.jsx` usando `SIMA_CHECK_PAGES` (Set) y `SIMA_CHECK_TABS` (array).

### Administración (Core)

- **Empresas** — tabla + modal crear/editar + toggle activo/inactivo
- **Usuarios** — tabla + modal crear/editar con roles (administrador/coordinador)

### Configuración *(placeholder)*

Sección visible en el sidebar — Roles y Permisos se agregarán en el futuro.

## App SIMA CHECK — flujo

Todas las pantallas son **tarjetas blancas** (`bg-white border border-slate-200 rounded-2xl shadow-2xl`) sobre un fondo claro con gradiente gris. Para usar imagen de fondo real, reemplazar el `background` inline en `App.jsx` por `backgroundImage: "url('/bg-industrial.jpg')"`.

El **logo** (`public/logo.png`) se renderiza en `App.jsx` encima de la card, visible en todas las pantallas.

1. **Ingreso por DNI** — campo numérico (`inputMode="numeric"`), botón INGRESAR, validaciones: vacío / DNI no encontrado
2. **Capacitaciones pendientes** — nombre y empresa del empleado + solo módulos con `assignment.status === 'pending'`; lista vertical de botones (`red-600`) con ícono y título; estado vacío si no hay pendientes
3. **Evaluación** — 3 preguntas aleatorias del módulo; barra de progreso avanza **al responder** (no al llegar); tipos de pregunta:
   - `truefalse`: 2 botones V/F (verde/rojo)
   - `multiple`: lista vertical, selección en `slate-900`
   - `image-options`: grid 2×2 de imágenes, selección con borde `red-600` + ring
   - Campo opcional `image` en cualquier pregunta: muestra imagen de contexto encima de las opciones
4. **Resultado** — score %, badge APROBADO (≥70%) / DESAPROBADO (<70%), botones: Mis capacitaciones / Reintentar / Volver al inicio

Al finalizar una evaluación, la asignación cambia de `pending → completed` **solo si el empleado aprueba** (≥70%). Si desaprueba, queda `pending` y el módulo sigue apareciendo en la lista.

## Datos mockeados

- **Empresas**: YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy
- **Usuarios**: 8 usuarios con roles `administrador` o `coordinador`
- **Empleados**: 15 empleados con `id`, `dni`, `name`, `companyId` (y `company` para display en la app)
- **Módulos de capacitación**: 4 módulos, ~10 preguntas cada uno (incluye preguntas reales de SIMA Avanzado)
- **Evaluaciones**: 20 registros históricos para el dashboard del backoffice
- **Asignaciones**: 27 asignaciones mockeadas con `status: 'pending' | 'completed' | 'expired'`

Las preguntas reales están en `sima-check/data/training-modules.js` del backoffice y `src/data/modules.js` de la app (módulo SIMA Avanzado, IDs 301–310).

## Arquitectura de archivos

```
sima-training-backoffice/src/
├── core/
│   ├── data/          companies.js · users.js · employees.js
│   └── pages/         Companies.jsx · Users.jsx
├── sima-check/
│   ├── data/          training-modules.js · training-assignments.js · evaluations.js
│   └── pages/         Overview.jsx · TrainingModules.jsx · Questions.jsx · TrainingAssignments.jsx
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
- La navegación de SIMA CHECK en el backoffice usa un Set (`SIMA_CHECK_PAGES`) en `BackofficeLayout.jsx` para detectar cuándo renderizar la barra de tabs y el breadcrumb de dos niveles.
- La pantalla Preguntas maneja su propia navegación interna (`selectedModuleId`) con `useState` — no requiere cambios en el router global.
- El campo `image` en preguntas es una ruta relativa a `public/` (ej: `/images/cartel.png`). Se recomienda `public/images/` para organizar los assets de preguntas.
- El tipo `image-options` usa las mismas rutas en `options[]` y `correctAnswer` — la comparación de respuesta correcta es por igualdad de string (misma ruta).

## Cómo agregar un producto futuro (ej: SIMA INSPECTIONS)

1. Crear `src/sima-inspections/data/` con sus entidades.
2. Crear `src/sima-inspections/pages/` con sus pantallas (incluyendo un `Overview.jsx`).
3. Agregar el producto al sidebar en `BackofficeLayout.jsx`:
   - Nuevo ítem en la sección "Productos"
   - Nuevo Set equivalente a `SIMA_CHECK_PAGES` y array de tabs
4. Registrar las páginas nuevas en `PAGES` de `App.jsx`.
5. Agregar una product card en `Dashboard.jsx`.
