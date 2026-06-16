# TRAINING — SIMA CHECK MVP

## Qué es esto

MVP navegable de alta fidelidad para validar el producto **SIMA CHECK** de **Ingeniería Sima** ante clientes de la industria Oil & Gas. No tiene backend ni base de datos — todos los datos son mockeados. Sirve como demo comercial y base para evolucionar hacia producción.

## Dos productos independientes

| Proyecto | Descripción | Puerto dev |
|---|---|---|
| `sima-check-backoffice/` | Interfaz admin/supervisor (SaaS corporativo) | 5173 |
| `sima-check-app/` | App de evaluación para tablets industriales | 5174 |

## Stack técnico

Ambos proyectos usan el mismo stack:
- **Vite + React** (template react)
- **Tailwind CSS v3** + PostCSS + Autoprefixer
- Sin router (navegación con `useState`)
- Sin backend, sin API, sin base de datos

## Cómo correr

```bash
# Backoffice
cd TRAINING/sima-check-backoffice
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

## Modelo de roles

| Rol | Acceso |
|---|---|
| `administrador` | Backoffice completo: empresas, usuarios, módulos, preguntas, asignaciones, métricas globales |
| `coordinador` | Backoffice limitado: asignaciones de su empresa, empleados de su empresa |
| Empleado | Solo App SIMA CHECK (acceso por DNI) |

## Backoffice — pantallas

1. **Dashboard** — KPIs (empresas activas, usuarios, módulos, % aprobación, asignaciones pendientes, asignaciones completadas) + gráfico SVG de barras por módulo + tabla de últimas evaluaciones
2. **Empresas** — tabla + modal crear/editar + toggle activo/inactivo
3. **Usuarios** — tabla + modal crear/editar con roles (administrador/coordinador)
4. **Módulos** — tabla + modal crear/editar + toggle activo/inactivo
5. **Preguntas** — tabla filtrable por módulo + modal crear/editar (soporte V/F y opción múltiple)
6. **Asignaciones** — tabla (empleado, empresa, módulo, estado, asignado por, fecha) + modal crear con validación de duplicados

Layout: sidebar fijo + header + contenido principal.

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
- **Módulos**: 4 módulos, ~10 preguntas cada uno (incluye preguntas reales de SIMA Avanzado)
- **Evaluaciones**: 20 registros históricos para el dashboard del backoffice
- **Asignaciones**: 25 asignaciones mockeadas con `status: 'pending' | 'completed' | 'expired'`

Las preguntas reales están en `src/data/modules.js` de cada proyecto (módulo SIMA Avanzado, IDs 301–310).

## Arquitectura de archivos

```
sima-check-backoffice/src/
├── data/          companies, users, employees, modules, evaluations, assignments
├── components/    Button, Card, Modal, Table, StatCard, ProgressBar
├── hooks/         useNavigation.js
└── pages/         Dashboard, Companies, Users, Modules, Questions, Assignments, BackofficeLayout

sima-check-app/src/
├── data/          employees, modules, assignments
├── components/    Button, ProgressBar, QuestionCard
├── hooks/         useNavigation.js
├── utils/         evaluation.js (pickRandomQuestions, calculateScore)
└── pages/         EmployeeSelection, ModuleSelection, Evaluation, Results
```

## Decisiones de arquitectura

- No se usa react-router intencionalmente.
- No existe persistencia entre sesiones — todo es estado local en React.
- Los datos viven en `src/data`. No se modifican directamente en runtime.
- El estado de `assignments` se eleva a `App.jsx` en la app tablet para permitir actualizaciones reactivas durante la sesión.
- Los modales manejan estado local.
- Los gráficos son SVG puro (sin librerías).
- Tailwind v3 es obligatorio.
- El campo `company` (string) se mantiene en el empleado junto a `companyId` para evitar importar `companies.js` en la app tablet.

## Cambios implementados (v2 — sistema de asignaciones)

### Nuevas entidades creadas

| Entidad | Archivo | Campos |
|---|---|---|
| `Employee` | `backoffice/src/data/employees.js` | `id, dni, name, companyId` |
| `Assignment` | `backoffice/src/data/assignments.js` | `id, employeeId, moduleId, assignedBy, assignedAt, status` |
| `Assignment` | `app/src/data/assignments.js` | `id, employeeId, moduleId, status` |

`status` admite: `'pending' | 'completed' | 'expired'`

### Nuevas pantallas

- **Backoffice → Asignaciones**: tabla con 6 columnas, modal crear con selects de empleado/módulo, validación de duplicados, badges de estado.

### Cambios de flujo

| Antes | Después |
|---|---|
| App: búsqueda por nombre | App: ingreso por DNI con validaciones |
| App: todos los módulos disponibles | App: solo módulos con asignación `pending` |
| App: resultado → reintentar o home | App: resultado → Mis capacitaciones / reintentar / home |
| App: asignación sin cambios | App: finalizar evaluación marca `pending → completed` |

### Cambios de roles

| Antes | Después |
|---|---|
| `admin`, `supervisor`, `empleado` | `administrador`, `coordinador` |
| Empleados en `users.js` | Empleados como entidad separada en `employees.js` |

### Funcionalidades operativas

- [x] Ingreso a la app por DNI (validación vacío / no encontrado)
- [x] Identificación del empleado con nombre y empresa
- [x] Lista de módulos filtrada por asignaciones pendientes
- [x] Estado vacío cuando no hay pendientes
- [x] Asignación `pending → completed` al finalizar (estado de sesión)
- [x] Lista de módulos se actualiza automáticamente tras completar
- [x] Backoffice: nueva sección Asignaciones en sidebar
- [x] Backoffice: tabla de asignaciones con todos los metadatos
- [x] Backoffice: crear asignación con validación de duplicados
- [x] Backoffice: roles actualizados a `administrador` / `coordinador`
- [x] Backoffice: Dashboard con KPIs de asignaciones pendientes y completadas
