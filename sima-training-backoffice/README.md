# SIMA TRAINING Backoffice

Backoffice de la plataforma **SIMA TRAINING** de Ingeniería Sima. Administra clientes, usuarios, empleados y los productos del ecosistema. **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado.

## Stack

- Vite + React (sin router — navegación con `useState`)
- Tailwind CSS v3
- Consume la API real (`sima-training-api`) para **Usuarios**; el resto de las pantallas sigue con datos mockeados en `src/` (se migran ABM por ABM)

## Cómo correr

Requiere el backend corriendo (ver [`../sima-training-api/README.md`](../sima-training-api/README.md)).

```bash
npm install
cp .env.example .env   # VITE_API_URL apunta al backend local
npm run dev            # → http://localhost:5173
```

## Arquitectura de carpetas

```
src/
├── core/                        # Entidades compartidas por toda la plataforma
│   ├── api/                     # client.js · usuarios.js · organizaciones.js (capa HTTP)
│   ├── data/                    # clients.js · users.js · employees.js (mock, en migración)
│   └── pages/                   # Clients.jsx · Users.jsx (Users ya usa la API real)
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
| Administración | Clientes · Usuarios |
| SIMA CHECK | Capacitaciones · Preguntas · Asignaciones |
| Configuración | *(placeholder — Roles y Permisos futuros)* |

## Agregar un producto futuro

Crear `src/sima-inspections/` con subcarpetas `data/` y `pages/`, agregar sus ítems de navegación en `NAV_SECTIONS` dentro de `BackofficeLayout.jsx`.
