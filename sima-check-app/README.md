# SIMA CHECK — App de evaluación

App tablet para capacitaciones y evaluaciones industriales. Parte del MVP de la plataforma **SIMA TRAINING** de Ingeniería Sima.

## Stack

- Vite + React
- Tailwind CSS v3
- Sin router, sin backend, sin base de datos — 100% mockeado. El backend real (`sima-training-api`) ya existe (Usuarios, Preguntas, Módulos, Asignaciones), pero esta app todavía no lo consume (ver [`../docs/pendientes.md`](../docs/pendientes.md))
- **PWA instalable** (`vite-plugin-pwa`): manifest, íconos, precache del shell y banner de actualización. Sigue mockeada — instalable no significa conectada, ver el punto anterior

## Correr en dev

```bash
npm install
npm run dev   # → http://localhost:5174
```

## Probar la PWA

El service worker **no corre con `npm run dev`** (Vite en dev no lo registra). Para probarlo hace falta buildear y servir el build:

```bash
npm run build
npm run preview   # → http://localhost:4173
```

Para probar la instalación en un dispositivo real (tablet/celular) hace falta HTTPS — `localhost` no sirve desde otro dispositivo en la red. La forma más simple es un túnel:

```bash
cloudflared tunnel --url http://localhost:4173
```

`preview.allowedHosts` en `vite.config.js` ya tiene whitelisteado `.trycloudflare.com` para que Vite no rechace las requests que llegan con ese host por el túnel.

## Estructura

```
src/
├── data/          usuarios.js · modules.js · assignments.js
├── components/    Button · ProgressBar · QuestionCard
├── utils/         evaluation.js (pickRandomQuestions, calculateScore)
└── pages/         UsuarioSelection · ModuleSelection · Evaluation · Results
```

## Flujo de la app

1. **Ingreso por DNI** — la persona ingresa su DNI para identificarse
2. **Capacitaciones pendientes** — lista de módulos con asignación `status: 'pending'`
3. **Evaluación** — 3 preguntas aleatorias del módulo seleccionado
4. **Resultado** — APROBADO (≥70%) o DESAPROBADO (<70%)

Si la persona aprueba, la asignación pasa a `completed`. Si desaprueba, queda `pending` y puede reintentar.

## Tipos de pregunta

| Tipo | Descripción | Renderizado |
|---|---|---|
| `truefalse` | Verdadero / Falso | 2 botones (verde/rojo) |
| `multiple` | Opción múltiple con texto | Lista vertical, selección resaltada en oscuro |
| `image-options` | Opciones como imágenes | Grid 2×2 de imágenes, selección con borde rojo |

Cada pregunta puede tener un campo `image` opcional (ruta en `public/`) que muestra una imagen de contexto encima de las opciones.

## Imágenes

- Fondo de pantalla: `public/SIMACHECK-FONDO.webp` (generado con `npm run iconos` a partir de `SIMACHECK-FONDO.png`, que se conserva en `public/` sin usar en runtime)
- Logo: `public/SIMA_CHECK-logo.png`
- Imágenes de preguntas/opciones: recomendado en `public/images/`
