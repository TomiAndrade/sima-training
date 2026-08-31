# SIMA TRAINING Backoffice

Backoffice de la plataforma **SIMA TRAINING** de Ingeniería Sima. Administra organizaciones, usuarios, catálogos de nómina (puestos, centros de costo) y los productos del ecosistema. **SIMA CHECK** (capacitaciones y evaluaciones) es el primer producto integrado.

## Stack

- Vite + React (sin router — navegación por el **hash de la URL**, ver [`../CLAUDE.md`](../CLAUDE.md#decisiones-de-arquitectura))
- Tailwind CSS v3
- **100% backend, sin ningún mock**: el último (la pantalla Clientes, sobre un array en memoria) se eliminó junto con `core/data/` — hoy la administración de organizaciones se hace directo contra `/organizaciones` desde script/API, sin ABM propio en el backoffice todavía (ver [`../docs/pendientes.md`](../docs/pendientes.md))
- Usuarios lee y escribe la **forma anidada** de `GET /usuarios` (`usuario.vinculacion.rol` / `.organizacion` / `.pares` / `.parPrincipal`), no campos planos

## Autenticación (Auth0)

El login es **Auth0** (Universal Login), no credenciales propias: `main.jsx` envuelve la app en `Auth0Provider`, `App.jsx` dispara `loginWithRedirect()` si no hay sesión y registra el token getter (`getAccessTokenSilently`) que `core/api/client.js` usa en cada request autenticado (`api.post`/`put`/`patch`/`del`/`getAuth`). Si la sesión ya no se puede renovar sola (refresh token vencido), `client.js` dispara un segundo callback registrado desde `App.jsx` que redirige de nuevo al login — ver [`../docs/decisiones/infraestructura.md`](../docs/decisiones/infraestructura.md#sesión-de-auth0-vencida-redirige-a-login-no-se-cuelga).

Variables de entorno relevantes (ver [`.env.example`](.env.example)): `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`.

## Cómo correr

Requiere el backend corriendo (ver [`../sima-training-api/README.md`](../sima-training-api/README.md)).

```bash
npm install
cp .env.example .env   # VITE_API_URL apunta al backend local, más las vars de Auth0
npm run dev            # → http://localhost:5173
```

## Arquitectura de carpetas

```
src/
├── core/                 # Entidades compartidas por toda la plataforma
│   ├── api/               client.js (fetch + Auth0 + BASE_URL) · usuarios.js ·
│   │                      organizaciones.js · puestos.js · centrosCosto.js ·
│   │                      modulos.js · preguntas.js · basesConocimiento.js ·
│   │                      import.js · reglasAsignacion.js · asignaciones.js ·
│   │                      resumen.js · estadisticas.js · sesiones.js · health.js
│   ├── format/             version.js · badges.js · catalogo.js · tipoPregunta.jsx ·
│   │                      opcionesPregunta.js · texto.js  (helpers compartidos
│   │                      entre core/ y sima-check/ — ver CLAUDE.md)
│   ├── components/         ImportUsuariosModal.jsx · ImportPreguntasModal.jsx ·
│   │                      ParesPuestoCentro.jsx · estadoSimilitudBadge.jsx ·
│   │                      VerIntentoModal.jsx
│   └── pages/              Usuarios.jsx · Puestos.jsx · CentrosCosto.jsx ·
│                          HistorialUsuario.jsx (hoja de vida de una persona;
│                          se entra desde Usuarios.jsx por early return)
├── sima-check/           # Producto: capacitaciones y evaluaciones
│   ├── components/         BancoPreguntas.jsx · CriteriosPanel.jsx ·
│   │                      ParametrosExamenPanel.jsx (+ parametrosExamen.js) ·
│   │                      bancoModulo.jsx
│   └── pages/               Overview.jsx (Resumen) · TrainingModules.jsx ·
│                          Questions.jsx · BasesConocimiento.jsx ·
│                          ReglasAsignacion.jsx · TrainingAssignments.jsx ·
│                          Estadisticas.jsx
├── pages/                # Shell: BackofficeLayout.jsx · Dashboard.jsx
├── components/           # Button · Modal · Table · StatCard · MultiSelectFilter ·
│                         SearchableSelect · ErrorFallback
└── hooks/                # useNavigation.js
```

## Navegación

| Sección | Páginas |
|---|---|
| (root) | Panel Principal (Dashboard) |
| Administración | Usuarios · Puestos · Centros de Costo |
| SIMA CHECK | Resumen · Módulos · Preguntas · Bases · Reglas · Asignaciones · Estadísticas |

> La sección **Configuración** se sacó del array `NAV_SECTIONS` (`BackofficeLayout.jsx`): era un `header` con `items: []`, y el render dibuja el rótulo aunque no haya ítems, así que en pantalla quedaba una etiqueta huérfana. Se vuelve a agregar cuando exista una pantalla real de Roles y Permisos.

> **Bases** es la taxonomía del banco de preguntas: cada base es un tema ("Gestión de residuos") y adentro define su propia escala **ordinal** de dificultad. La escala es por base a propósito — una puede necesitar 3 niveles y otra 5. Va pegada a **Preguntas** porque es donde se definen los temas con los que después se clasifican.

> **Reglas** y **Asignaciones** son las dos caras del motor de asignación automática. En Reglas se configura qué módulo es obligatorio para un par (puesto, centro de costo) o para un centro entero; Asignaciones es una pantalla de **consulta por persona** que muestra qué le corresponde y por qué. Las asignaciones no se cargan una por una: las deriva el motor a partir de las reglas y de los pares de cada quien.

## Agregar un producto futuro

Crear `src/sima-inspections/pages/` (con un `Overview.jsx`), agregar sus ítems de navegación en `NAV_SECTIONS` dentro de `BackofficeLayout.jsx` y registrar las páginas en `PAGES` de `App.jsx`. Detalle completo en [`../CLAUDE.md`](../CLAUDE.md#cómo-agregar-un-producto-futuro-ej-sima-inspections).
