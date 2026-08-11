# Decisiones de diseño — SIMA TRAINING

Por qué el sistema es como es. Un archivo por **dominio**, no por sprint.

## Por qué por dominio y no por sprint

El orden cronológico sólo le sirve a quien vivió los sprints. Alguien que abre `asignaciones.service.ts` quiere el porqué **de ese archivo**, no un recorrido por ocho sprints — y con el formato anterior tenía que leer "Sprint 2", "Asignaciones automáticas", "Sprint 8" y "Story 8" para juntar las piezas de una sola decisión.

Consecuencias de la convención, para mantenerla:

- **Una decisión vive en un solo archivo.** Si toca dos dominios, va en el principal y el otro la referencia con un link.
- **Cada archivo incluye el frontend de su dominio.** "Cómo se editan los módulos" incluye la pantalla que los edita: la división es por tema, no por capa.
- **No hay changelog.** Se documenta el diseño **vigente**. Un diseño anterior se menciona —en una línea, dentro de la decisión que lo reemplazó— sólo cuando explica por qué el actual es así, o sea cuando alguien podría razonablemente proponer volver atrás. Si nadie lo propondría, no se menciona.
- **Al cambiar una decisión se reescribe la sección, no se apila una nueva.**

## Los ocho archivos

| Archivo | Qué contiene |
|---|---|
| [usuarios.md](usuarios.md) | `Usuario` como identidad pura, `Vinculacion`, los pares puesto+centro, la matriz tipo-de-organización ↔ rol y el import de nómina |
| [preguntas.md](preguntas.md) | El banco: `Pregunta`, sus dos bajas lógicas, las imágenes, la detección de duplicados, el import desde Excel, y la clasificación en `BaseConocimiento`/`NivelBase` |
| [modulos.md](modulos.md) | `Modulo` y `ModuloVersion` (versionado inmutable), el pivot con sus dos orígenes, `ModuloVersionCriterio` y el editor de contenido |
| [asignaciones.md](asignaciones.md) | `ReglaAsignacion` y `Asignacion`, el motor `recalcular()`, la vigencia de las aprobaciones y el veredicto de habilitación |
| [sesiones.md](sesiones.md) | `Sesion` y `Respuesta`: la rendición de una evaluación, la corrección, el umbral y la idempotencia |
| [tablet.md](tablet.md) | El namespace HTTP `/tablet`, la autenticación de alumno y la PWA de `sima-check-app` |
| [auditoria.md](auditoria.md) | `AuditLog`: qué se audita, el diff, y por qué la tabla es polimórfica |
| [infraestructura.md](infraestructura.md) | Storage, deploy, CI, el seed y su orden de borrado, y las constraints que Prisma no conoce |

## Qué NO vive acá

- **El estado actual** (entidades, endpoints, módulos NestJS, pantallas, arquitectura de archivos): [`../../CLAUDE.md`](../../CLAUDE.md) y [`../../sima-training-api/README.md`](../../sima-training-api/README.md).
- **Lo que falta hacer**: [`../pendientes.md`](../pendientes.md).
- **El recorte de cada sprint**: [`../sprint_07-08.md`](../sprint_07-08.md) y sus antecesores.
