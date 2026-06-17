# SIMA CHECK — App de evaluación

App tablet para capacitaciones y evaluaciones industriales. Parte del MVP de la plataforma **SIMA TRAINING** de Ingeniería Sima.

## Stack

- Vite + React
- Tailwind CSS v3
- Sin router, sin backend, sin base de datos

## Correr en dev

```bash
npm install
npm run dev   # → http://localhost:5174
```

## Estructura

```
src/
├── data/          employees.js · modules.js · assignments.js
├── components/    Button · ProgressBar · QuestionCard
├── utils/         evaluation.js (pickRandomQuestions, calculateScore)
└── pages/         EmployeeSelection · ModuleSelection · Evaluation · Results
```

## Flujo de la app

1. **Ingreso por DNI** — el empleado ingresa su DNI para identificarse
2. **Capacitaciones pendientes** — lista de módulos con asignación `status: 'pending'`
3. **Evaluación** — 3 preguntas aleatorias del módulo seleccionado
4. **Resultado** — APROBADO (≥70%) o DESAPROBADO (<70%)

Si el empleado aprueba, la asignación pasa a `completed`. Si desaprueba, queda `pending` y puede reintentar.

## Tipos de pregunta

| Tipo | Descripción | Renderizado |
|---|---|---|
| `truefalse` | Verdadero / Falso | 2 botones (verde/rojo) |
| `multiple` | Opción múltiple con texto | Lista vertical, selección resaltada en oscuro |
| `image-options` | Opciones como imágenes | Grid 2×2 de imágenes, selección con borde rojo |

Cada pregunta puede tener un campo `image` opcional (ruta en `public/`) que muestra una imagen de contexto encima de las opciones.

## Imágenes

- Fondo de pantalla: `public/SIMACHECK-FONDO.png`
- Logo: `public/logo.png`
- Imágenes de preguntas/opciones: recomendado en `public/images/`
