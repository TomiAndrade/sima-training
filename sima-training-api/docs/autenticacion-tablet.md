# Autenticación de la app tablet (spike)

Story 5 necesita que la tablet identifique a la persona que va a rendir una
evaluación. Este documento es el resultado de ese spike, referenciado desde
`src/tablet/`.

## Recomendación

**DNI + PIN.** El DNI solo no alcanza: es un dato semi-público (aparece en
legajos, planillas, se puede ver por encima del hombro de otro alumno en el
mismo atril), así que cualquiera que lo conozca podría rendir una evaluación
a nombre de otra persona. Un PIN corto, propio de cada alumno, cierra ese
hueco sin la fricción de una contraseña completa en un dispositivo compartido
de atril.

## Preguntas abiertas (para Eduardo)

Sin resolver estas tres, el flujo con PIN no se puede implementar:

1. **Creación del PIN** — ¿lo define la persona la primera vez que usa la
   tablet, se lo asigna un admin al cargarla, o sale de algún dato ya
   existente (últimos dígitos del DNI, legajo)?
2. **Reset del PIN** — si alguien lo olvida, ¿quién lo puede resetear y
   desde dónde? No hay pantalla de administración de PIN todavía, y el
   backoffice no tiene un flujo de "olvidé mi clave".
3. **Alcance ISO 9001** — ¿la autenticación de quien rinde una evaluación de
   seguridad laboral necesita un nivel de trazabilidad/evidencia específico
   para la certificación, o alcanza con identificar a la persona?

## Decisión provisional (Story 5, commit 2)

Mientras estas preguntas siguen abiertas, `POST /tablet/login` acepta sólo
DNI, gateado por la variable de entorno `TABLET_LOGIN_SIN_PIN` (default
`'true'`, ver `.env.example`):

- En `'true'` (o ausente): login con DNI solamente, sin PIN.
- En `'false'`: el endpoint responde **501 Not Implemented** — el flujo con
  PIN todavía no existe, así que no hay nada que ese valor pueda activar.

`TabletModule` loguea un `warn` al arrancar mientras el flag está en `'true'`,
para que quede visible en cada arranque que la autenticación de la tablet es
interina. El día que las tres preguntas de arriba tengan respuesta, este
documento se actualiza con el diseño final y el flag deja de tener sentido.
