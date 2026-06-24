# Estado actual — SIMA TRAINING Platform

> Documento generado el 2026-06-23. Refleja el estado **real** del código tal como está implementado, sin suposiciones sobre lo que debería existir.

---

## 1. Stack y estructura general

### Stack técnico (ambos proyectos)

| Aspecto | Valor |
|---|---|
| Lenguaje | JavaScript (JSX) |
| Framework | React 19 |
| Build tool | Vite 8 |
| Estilos | Tailwind CSS v3 |
| Routing | Manual con `useState` (sin React Router) |
| Backend | **Ninguno** |
| Base de datos | **Ninguna** |
| API / HTTP | **Ninguna** (cero llamadas fetch/axios) |
| Autenticación | **Mockeada** (usuario hardcodeado) |
| Persistencia | **Solo en memoria** — se pierde al refrescar |

### Dos proyectos independientes

| Proyecto | Puerto | Propósito |
|---|---|---|
| `sima-training-backoffice/` | 5173 | Administración interna |
| `sima-check-app/` | 5174 | App de evaluación para tablets |

---

## 2. Backoffice (`sima-training-backoffice`)

### Estructura de carpetas

```
src/
├── components/          Button, Card, Modal, ProgressBar, StatCard, Table
├── core/
│   ├── data/            companies.js · users.js · employees.js
│   └── pages/           Companies.jsx · Users.jsx
├── hooks/               useNavigation.js
├── pages/               App.jsx · BackofficeLayout.jsx · Dashboard.jsx
└── sima-check/
    ├── data/            training-modules.js · training-assignments.js · evaluations.js
    └── pages/           Overview.jsx · TrainingModules.jsx · TrainingAssignments.jsx · Questions.jsx
```

### Modelo de datos (todo hardcodeado en archivos `.js`)

#### `Company` — `core/data/companies.js`
```
id | name | active
```
5 empresas: YPF, Pan American Energy, TotalEnergies, Pluspetrol, Vista Energy.

#### `User` — `core/data/users.js`
```
id | name | role ('administrador' | 'coordinador') | companyId
```
8 usuarios hardcodeados.

#### `Employee` — `core/data/employees.js`
```
id | dni | name | companyId
```
15 empleados distribuidos en las 5 empresas.

#### `TrainingModule` + `Question` — `sima-check/data/training-modules.js`
```
Módulo: id | name | active | questions[]
Pregunta: id | type | statement | correctAnswer | options[] | approvalRate | image
```
4 módulos, ~10 preguntas cada uno (41 en total). Tipos de pregunta: `truefalse`, `multiple`, `image-options`. Campo `approvalRate` (0–100) hardcodeado para cada pregunta.

#### `TrainingAssignment` — `sima-check/data/training-assignments.js`
```
id | employeeId | moduleId | assignedBy | assignedAt | status ('pending' | 'completed' | 'expired')
```
27 asignaciones hardcodeadas.

#### `Evaluation` — `sima-check/data/evaluations.js`
```
id | employeeName | moduleName | score | approved | date | companyId
```
20 registros históricos hardcodeados. **Solo lectura** — no se generan nuevos registros desde el backoffice.

### Comparación contra entidades esperadas

| Entidad esperada | Estado |
|---|---|
| Usuario | ✅ Existe (`users.js`) — sin autenticación real |
| Organización / Empresa | ✅ Existe (`companies.js`) |
| Vinculación | ❌ No existe como entidad separada |
| Módulo | ✅ Existe (`training-modules.js`) |
| Pregunta | ✅ Existe (embebida en módulo) |
| Sesión / Evaluación | ⚠️ Parcial — `evaluations.js` registra resultados históricos, pero son datos estáticos |
| Asignación | ✅ Existe (`training-assignments.js`) |

### Funcionalidad implementada por pantalla

#### Dashboard (`/`)
- KPIs calculados en tiempo real desde los datos en memoria.
- Tabla de actividad reciente: **hardcodeada** (`RECENT_ACTIVITY` array fijo).
- Estado del sistema: **hardcodeado** (`SYSTEM_STATUS` array fijo).
- Product cards: SIMA CHECK (activo), SIMA INSPECTIONS y SIMA AUDITS (roadmap, sin funcionalidad).

#### Empresas
- **Alta**: crea empresa con ID `Date.now()`, se agrega al estado local.
- **Edición**: modal con nombre y toggle activo/inactivo.
- **Toggle activo/inactivo**: funcional en memoria.
- **Baja**: ❌ no implementada.
- **Persistencia**: ❌ se pierde al refrescar.

#### Usuarios
- **Alta**: nombre, rol (administrador/coordinador), empresa.
- **Edición**: igual que alta.
- **Baja**: ❌ no implementada.
- **Persistencia**: ❌ se pierde al refrescar.

#### SIMA CHECK → Resumen
- 6 StatCards con métricas calculadas desde los datos en memoria.
- Gráfico de barras SVG de % aprobación por módulo (calculado desde `evaluations.js`).
- Lista de últimas 7 evaluaciones (ordenadas por ID, datos estáticos).

#### SIMA CHECK → Capacitaciones
- **Alta de módulo**: nombre + toggle activo.
- **Edición de módulo**: mismos campos.
- **Toggle activo/inactivo**: funcional.
- **Baja**: ❌ no implementada.
- **Gestión de preguntas**: pantalla separada (ver Preguntas más abajo).

#### SIMA CHECK → Preguntas ⚠️
- Pantalla completa implementada pero **sin tab visible** en la barra de SIMA CHECK. La ruta existe pero no está en `SIMA_CHECK_PAGES` del layout actual.
- **Vista módulos**: grid de 4 cards, muestra cantidad de preguntas y estado.
- **Vista preguntas del módulo**: tabla con columna de % aprobación (número grande + barra de progreso coloreada).
- **Ranking de errores**: tabla global de todas las preguntas, ordenadas por tasa de error descendente.
- **Alta de pregunta**: tipos `truefalse`, `multiple`, `image-options`. Campo imagen opcional.
- **Edición de pregunta**: mismos campos.
- **Baja**: ❌ no implementada.

#### SIMA CHECK → Asignaciones
- Tabla con filtros en tiempo real: búsqueda por nombre o DNI, filtro por empresa, filtro por estado.
- **Alta de asignación**: selección de empleado + módulo, validación de duplicados.
- **Edición / Baja**: ❌ no implementadas.
- **Lógica de rol**: si el usuario actual es `coordinador`, solo ve empleados de su empresa. Usuario simulado hardcodeado en línea 18: `users.find((u) => u.id === 1)`.

### Autenticación
**No existe.** El usuario logueado es `users.find(u => u.id === 1)` — "Carlos Méndez", administrador — hardcodeado. No hay pantalla de login, token, sesión ni cookie. Un comentario en el código dice: _"cambiar id para probar distintos roles"_.

### Importación Excel/CSV
❌ No implementada.

---

## 3. App tablet SIMA CHECK (`sima-check-app`)

### Estructura de carpetas

```
src/
├── components/     Button.jsx · ProgressBar.jsx · QuestionCard.jsx
├── data/           employees.js · modules.js · assignments.js
├── hooks/          useNavigation.js  ← definido pero no se usa
├── pages/          EmployeeSelection · ModuleSelection · Evaluation · Results
├── utils/          evaluation.js
└── App.jsx
```

### Datos (todos hardcodeados)

| Archivo | Contenido |
|---|---|
| `employees.js` | 15 empleados con id, dni, name, company, companyId |
| `modules.js` | 4 módulos con preguntas embebidas (41 preguntas totales) |
| `assignments.js` | ~27 asignaciones (pending / completed / expired) |

### Flujo implementado

```
Ingreso por DNI
    ↓
Selección de módulo (solo muestra asignaciones pending del empleado)
    ↓
Evaluación (3 preguntas aleatorias; las "pinned" siempre aparecen)
    ↓
Resultado (score ≥ 70% = APROBADO)
    ↓
Si aprobó → asignación pasa a "completed" (en memoria, no persiste)
Si desaprobó → asignación queda "pending", puede reintentar
```

### Tipos de pregunta soportados

| Tipo | Renderizado |
|---|---|
| `truefalse` | 2 botones grandes (Verdadero / Falso), verde y rojo |
| `multiple` | Lista vertical con letras A/B/C/D |
| `image-options` | Grid 2×2 de imágenes clickeables |
| Campo `image` opcional | Imagen de contexto encima de las opciones (cualquier tipo) |

### Autenticación
No existe. El acceso es únicamente por DNI numérico, validado contra la lista local de empleados. No hay contraseña, token ni sesión.

### Recursos en `public/`

| Archivo | Uso |
|---|---|
| `SIMACHECK-FONDO.png` | Fondo de toda la app |
| `logo.png` | Logo encima de la card |
| `tacho-amarillo.png` | Imagen para pregunta de ejemplo (tipo image-options) |
| `tacho-verde.png` | Respuesta correcta del ejemplo |
| `tacho-negro.png` | Opción incorrecta del ejemplo |

---

## 4. Estado y pendientes

### Completo y funcional

- Flujo completo de evaluación en la app tablet.
- ABM parcial (Create + Read + Update) de: Empresas, Usuarios, Módulos, Preguntas.
- Filtros en la tabla de Asignaciones.
- Ranking de preguntas por tasa de error.
- Lógica de roles simulada (administrador vs. coordinador).
- Diseño completo en modo claro.

### A medio hacer / pendiente

- **Tab "Preguntas" eliminado** del menú de SIMA CHECK — la página existe y funciona, pero no es accesible desde la UI actual.
- **Baja (delete)** de cualquier entidad: no implementada en ningún módulo.
- **Evaluaciones nuevas no se registran** en el backoffice — solo hay 20 registros históricos estáticos.
- **`useNavigation.js`** definido pero no utilizado en ningún archivo.

### Falta por completo

- Backend / API real.
- Base de datos.
- Autenticación real (login, roles, sesiones).
- Persistencia de datos entre sesiones.
- Registro de nuevas evaluaciones desde la app tablet hacia el backoffice.
- Importación de datos (Excel/CSV).
- Baja de registros en cualquier entidad.
- Sincronización entre los datos de la app tablet (`sima-check-app/src/data/`) y el backoffice (`sima-training-backoffice/src/sima-check/data/`) — son dos copias independientes que se mantienen manualmente.
