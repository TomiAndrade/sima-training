# SIMA TRAINING Backoffice

Backoffice de la plataforma **SIMA TRAINING** de Ingeniería Sima. Administra empresas, usuarios, empleados y los productos del ecosistema. **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado.

## Stack

- Vite + React (sin router — navegación con `useState`)
- Tailwind CSS v3
- Sin backend ni base de datos — datos mockeados en `src/`

## Cómo correr

```bash
npm install
npm run dev   # → http://localhost:5173
```

## Arquitectura de carpetas

```
src/
├── core/                        # Entidades compartidas por toda la plataforma
│   ├── data/                    # companies.js · users.js · employees.js
│   └── pages/                   # Companies.jsx · Users.jsx
├── sima-check/                  # Producto: capacitaciones y evaluaciones
│   ├── data/                    # training-modules.js · training-assignments.js · evaluations.js
│   └── pages/                   # TrainingModules.jsx · Questions.jsx · TrainingAssignments.jsx
├── pages/                       # Shell: BackofficeLayout.jsx · Dashboard.jsx
├── components/                  # Button · Card · Modal · Table · StatCard · ProgressBar
└── hooks/                       # useNavigation.js
```

## Navegación

| Sección | Páginas |
|---|---|
| (root) | Dashboard |
| Administración | Empresas · Usuarios |
| SIMA CHECK | Capacitaciones · Preguntas · Asignaciones |
| Configuración | *(placeholder — Roles y Permisos futuros)* |

## Agregar un producto futuro

Crear `src/sima-inspections/` con subcarpetas `data/` y `pages/`, agregar sus ítems de navegación en `NAV_SECTIONS` dentro de `BackofficeLayout.jsx`.
