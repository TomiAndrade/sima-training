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

## Backoffice — pantallas

1. **Dashboard** — KPIs (empresas activas, usuarios, módulos, % aprobación) + gráfico SVG de barras por módulo + tabla de últimas evaluaciones
2. **Empresas** — tabla + modal crear/editar + toggle activo/inactivo
3. **Usuarios** — tabla + modal crear/editar con roles (admin/supervisor/empleado)
4. **Módulos** — tabla + modal crear/editar + toggle activo/inactivo
5. **Preguntas** — tabla filtrable por módulo + modal crear/editar (soporte V/F y opción múltiple)

Layout: sidebar fijo + header + contenido principal.

## App SIMA CHECK — flujo

1. **Selección de empleado** — buscador en vivo sobre lista de 15 empleados mockeados
2. **Selección de módulo** — 4 cards grandes (SIMA Básico, Intermedio, Avanzado, Reglas de Oro)
3. **Evaluación** — 3 preguntas aleatorias del módulo, barra de progreso, opciones táctiles grandes
4. **Resultado** — score %, badge APROBADO (≥70%) / DESAPROBADO (<70%), reintentar o volver al inicio

## Datos mockeados

- **Empresas**: YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy
- **Usuarios**: 10 usuarios con roles distribuidos entre empresas
- **Módulos**: 4 módulos, ~10 preguntas cada uno (incluye preguntas reales de SIMA Avanzado)
- **Evaluaciones**: 20 registros históricos para el dashboard del backoffice
- **Empleados** (solo en app): 15 empleados de distintas empresas

Las preguntas reales están en `src/data/modules.js` de cada proyecto (módulo SIMA Avanzado, IDs 301–310).

## Arquitectura de archivos

```
sima-check-backoffice/src/
├── data/          companies, users, modules, evaluations
├── components/    Button, Card, Modal, Table, StatCard, ProgressBar
├── hooks/         useNavigation.js
└── pages/         Dashboard, Companies, Users, Modules, Questions, BackofficeLayout

sima-check-app/src/
├── data/          employees, modules
├── components/    Button, ProgressBar, QuestionCard
├── hooks/         useNavigation.js
├── utils/         evaluation.js (pickRandomQuestions, calculateScore)
└── pages/         EmployeeSelection, ModuleSelection, Evaluation, Results
```

## Estado actual

- [x] Ambos productos funcionales y navegables
- [x] Paleta roja y blanca aplicada
- [x] Datos mockeados con preguntas reales del dominio Oil & Gas
- [x] Pusheado en rama `develop` del monorepo
- [ ] Mejoras visuales y UX pendientes (mencionadas por el usuario pero no especificadas aún)
- [ ] Sin backend real — todo es estado local en React
