# SIMA TRAINING Backoffice

Backoffice de la plataforma **SIMA TRAINING** de Ingeniería Sima. Administra clientes, usuarios, catálogos de nómina (puestos, centros de costo) y los productos del ecosistema. **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado.

## Stack

- Vite + React (sin router — navegación con `useState`)
- Tailwind CSS v3
- Consume la API real (`sima-training-api`) para **Usuarios, Puestos, Centros de Costo, Preguntas, Módulos, Reglas y Asignaciones** (100% backend, sin mock). Lo que sigue con datos mockeados en `src/` es **Clientes**, el **Dashboard** y el **Resumen** de SIMA CHECK salvo el StatCard de Módulos activos (se migra ABM por ABM — ver [`../docs/pendientes.md`](../docs/pendientes.md))
- Usuarios lee y escribe la **forma anidada** de `GET /usuarios` (`usuario.vinculacion.rol` / `.organizacion` / `.pares` / `.parPrincipal`), no los campos planos que el backend dejó de exponer. `clasificacion` se disolvió como concepto y no aparece en ningún frontend

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
│   │                     centrosCosto.js · preguntas.js · modulos.js ·
│   │                     basesConocimiento.js · import.js · reglasAsignacion.js ·
│   │                     asignaciones.js  (capa HTTP)
│   ├── data/              clients.js · users.js · usuarios-mock.js  (mock, en migración)
│   ├── components/        ImportUsuariosModal.jsx · ImportPreguntasModal.jsx ·
│   │                     ParesPuestoCentro.jsx · estadoSimilitudBadge.jsx
│   └── pages/             Clients.jsx (mock) · Usuarios.jsx · Puestos.jsx ·
│                          CentrosCosto.jsx  (los tres últimos, API real)
├── sima-check/          # Producto: capacitaciones y evaluaciones
│   ├── data/              training-modules.js · training-assignments.js · evaluations.js
│   │                     (mock; hoy solo alimentan Dashboard y Resumen)
│   ├── components/        BancoPreguntas.jsx  (banco/asignación de preguntas,
│   │                     compartido entre Preguntas y Módulos) ·
│   │                     CriteriosPanel.jsx  ("qué evalúa este módulo":
│   │                     los criterios base+nivel de la versión en edición) ·
│   │                     bancoModulo.jsx
│   └── pages/             Overview.jsx (mock) · TrainingModules.jsx · Questions.jsx ·
│                          BasesConocimiento.jsx · ReglasAsignacion.jsx ·
│                          TrainingAssignments.jsx  (los cinco últimos, 100% backend)
├── pages/               # Shell: BackofficeLayout.jsx · Dashboard.jsx
├── components/          # Button · Modal · Table · StatCard · MultiSelectFilter
└── hooks/               # useNavigation.js
```

## Navegación

| Sección | Páginas |
|---|---|
| (root) | Panel Principal (Dashboard) |
| Administración | Clientes · Usuarios · Puestos · Centros de Costo |
| SIMA CHECK | Resumen · Módulos · Preguntas · Bases · Reglas · Asignaciones |
| Configuración | *(placeholder — Roles y Permisos futuros)* |

> **Bases** es la taxonomía del banco de preguntas: cada base es un tema ("Gestión de residuos") y adentro define su propia escala **ordinal** de dificultad. La escala es por base a propósito — una puede necesitar 3 niveles y otra 5. Va pegada a **Preguntas** porque es donde se definen los temas con los que después se clasifican.

> **Reglas** y **Asignaciones** son las dos caras del motor de asignación automática. En Reglas se configura qué módulo es obligatorio para un par (puesto, centro de costo) o para un centro entero; Asignaciones es una pantalla de **consulta por persona** que muestra qué le corresponde y por qué. Las asignaciones no se cargan una por una: las deriva el motor a partir de las reglas y de los pares de cada quien.

## Agregar un producto futuro

Crear `src/sima-inspections/` con subcarpetas `data/` y `pages/`, agregar sus ítems de navegación en `NAV_SECTIONS` dentro de `BackofficeLayout.jsx`.
