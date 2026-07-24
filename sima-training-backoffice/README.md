# SIMA TRAINING Backoffice

Backoffice de la plataforma **SIMA TRAINING** de Ingeniería Sima. Administra clientes, usuarios, catálogos de nómina (puestos, centros de costo) y los productos del ecosistema. **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado.

## Stack

- Vite + React (sin router — navegación con `useState`)
- Tailwind CSS v3
- Consume la API real (`sima-training-api`) para **Usuarios, Puestos, Centros de Costo, Preguntas y Módulos** (100% backend, sin mock); el resto (Clientes, Resumen de SIMA CHECK salvo el StatCard de Módulos activos, Asignaciones) sigue con datos mockeados en `src/` (se migra ABM por ABM). ⚠️ **Usuarios todavía consume la forma vieja de `GET /usuarios`** (`usuario.rol` plano, `clasificacion`) — el backend ya expone `vinculacion` anidada; migrarlo es trabajo pendiente (ver [`../docs/pendientes.md`](../docs/pendientes.md))

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
├── core/                # Entidades compartidas por toda la plataforma
│   ├── api/              client.js · usuarios.js · organizaciones.js · puestos.js ·
│   │                     centrosCosto.js · preguntas.js · modulos.js · etiquetas.js ·
│   │                     import.js  (capa HTTP)
│   ├── data/              clients.js · users.js · usuarios-mock.js  (mock, en migración)
│   ├── components/        ImportUsuariosModal.jsx · ImportPreguntasModal.jsx
│   └── pages/             Clients.jsx · Usuarios.jsx · Puestos.jsx · CentrosCosto.jsx
│                          (Usuarios/Puestos/CentrosCosto ya usan la API real)
├── sima-check/          # Producto: capacitaciones y evaluaciones
│   ├── data/              training-modules.js · training-assignments.js · evaluations.js
│   │                     (mock; Módulos y Preguntas ya no lo usan, ver abajo)
│   ├── components/        BancoPreguntas.jsx  (banco/asignación de preguntas,
│   │                     compartido entre Preguntas y Módulos) · bancoModulo.jsx
│   └── pages/             Overview.jsx · TrainingModules.jsx (100% backend) ·
│                          Questions.jsx (100% backend) · TrainingAssignments.jsx (mock)
├── pages/               # Shell: BackofficeLayout.jsx · Dashboard.jsx
├── components/          # Button · Card · Modal · Table · StatCard · ProgressBar · MultiSelectFilter
└── hooks/               # useNavigation.js
```

## Navegación

| Sección | Páginas |
|---|---|
| (root) | Panel Principal (Dashboard) |
| Administración | Clientes · Usuarios · Puestos · Centros de Costo |
| SIMA CHECK | Resumen · Módulos · Preguntas · Asignaciones |
| Configuración | *(placeholder — Roles y Permisos futuros)* |

> El backend ya tiene un modelo completo de `Asignacion`/`ReglaAsignacion` (asignaciones automáticas por par puesto+centro → módulo), pero la pantalla "Asignaciones" todavía no lo consume: sigue siendo el mock viejo de `training-assignments.js`. Ver [`../docs/pendientes.md`](../docs/pendientes.md).

## Agregar un producto futuro

Crear `src/sima-inspections/` con subcarpetas `data/` y `pages/`, agregar sus ítems de navegación en `NAV_SECTIONS` dentro de `BackofficeLayout.jsx`.
