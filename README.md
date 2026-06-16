# SIMA CHECK — MVP

> **Estado: MVP de demostración.** No tiene backend ni base de datos. Todos los datos son mockeados. Sirve para validar el producto ante clientes y como base para evolucionar a producción.

MVP navegable de alta fidelidad para **Ingeniería Sima**, orientado a la industria Oil & Gas. Incluye dos productos independientes: un backoffice de administración y una app de evaluación para tablets industriales.

---

## Productos

| Proyecto | Descripción | Puerto dev |
|---|---|---|
| `sima-check-backoffice/` | Interfaz admin/supervisor (SaaS corporativo) | 5173 |
| `sima-check-app/` | App de evaluación para tablets industriales | 5174 |

Cada uno tiene su propio `package.json` y se corre de forma independiente.

---

## Stack

Ambos proyectos comparten el mismo stack:

- **Vite + React** (template react)
- **Tailwind CSS v3** + PostCSS + Autoprefixer
- Navegación con `useState` (sin react-router)
- Sin backend, sin API, sin base de datos

---

## Cómo correr

```bash
# Backoffice
cd sima-check-backoffice
npm install
npm run dev   # → http://localhost:5173

# App tablet
cd sima-check-app
npm install
npm run dev   # → http://localhost:5174
```

---

## Backoffice — pantallas

1. **Dashboard** — KPIs (empresas activas, usuarios, módulos, % aprobación) + gráfico SVG de barras por módulo + tabla de últimas evaluaciones
2. **Empresas** — tabla + modal crear/editar + toggle activo/inactivo
3. **Usuarios** — tabla + modal crear/editar con roles (admin / supervisor / empleado)
4. **Módulos** — tabla + modal crear/editar + toggle activo/inactivo
5. **Preguntas** — tabla filtrable por módulo + modal crear/editar (V/F y opción múltiple)

Layout: sidebar fijo + header + contenido principal.

## App SIMA CHECK — flujo

1. **Selección de empleado** — buscador en vivo sobre 15 empleados mockeados
2. **Selección de módulo** — 4 cards grandes (SIMA Básico, Intermedio, Avanzado, Reglas de Oro)
3. **Evaluación** — 3 preguntas aleatorias del módulo, barra de progreso, opciones táctiles grandes
4. **Resultado** — score %, badge APROBADO (≥ 70%) / DESAPROBADO (< 70%), reintentar o volver al inicio

---

## Datos mockeados

| Entidad | Detalle |
|---|---|
| Empresas | YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy |
| Usuarios | 10 usuarios con roles distribuidos entre empresas |
| Módulos | 4 módulos, ~10 preguntas cada uno |
| Evaluaciones | 20 registros históricos (para el dashboard) |
| Empleados | 15 empleados de distintas empresas (solo en la app) |

Las preguntas incluyen contenido real del dominio Oil & Gas (módulo SIMA Avanzado, IDs 301–310) ubicadas en `src/data/modules.js` de cada proyecto.

---

## Estructura de archivos

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

---

## Paleta de colores

Identidad visual de Ingeniería Sima: rojo y blanco sobre fondo oscuro industrial.

| Uso | Clase Tailwind |
|---|---|
| Acento principal | `red-600` |
| Fondo profundo | `slate-950` |
| Fondo card | `slate-900` / `slate-800` |
| Aprobado | `emerald-500` |
| Desaprobado / peligro | `red-600` |
