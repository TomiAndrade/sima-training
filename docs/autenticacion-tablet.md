# Autenticación en dispositivos multiusuario (spike)

Story 2 del sprint 07-08. Investigación, sin implementación — el objetivo es dejar la recomendación escrita y razonada para que la Story 5 (endpoints de ingreso de la app tablet) la tome como dada.

## El escenario

SIMA CHECK se va a usar de dos formas, las dos operativas para septiembre:

- **Tablet en atril**: un dispositivo compartido, con muchas personas rindiendo una detrás de otra a lo largo del día.
- **Celular propio**: cada persona entra desde su propio equipo.

El caso duro es el atril. Ahí no hay "el dueño del dispositivo" al que autenticar una sola vez a la mañana: cada persona que se sienta tiene que quedar identificada de forma confiable, y el dispositivo tiene que volver a un estado neutro apenas termina.

## Identificación vs. autenticación

Identificar es saber *quién dice ser* alguien. Autenticar es comprobar que es verdad. Un DNI tipeado en una pantalla identifica: le dice al sistema "soy Carlos Ferreyra, DNI 12.345.678". Pero no autentica nada, porque el DNI de una persona no es un secreto — lo sabe la empresa, lo sabe cualquiera que haya visto su credencial, y en el caso del atril lo puede haber visto literalmente la persona anterior en la fila.

Esto importa porque SIMA CHECK no es un formulario de opinión: es una evaluación de seguridad laboral cuyo resultado (aprobado/desaprobado) certifica que *esa persona específica* sabe lo que tiene que saber para trabajar sin riesgo. Si alguien puede rendir en nombre de otro con solo conocer su DNI, el certificado deja de significar nada — es exactamente el fraude que el sistema existe para evitar. Por eso identificar con DNI no alcanza: hace falta además un secreto que solo la persona dueña de ese DNI conozca. Ese es el rol del PIN.

## Dos problemas separados

Conviene no mezclarlos, porque tienen soluciones distintas:

1. **Autenticar el dispositivo**: ¿este atril es uno que la organización puso ahí a propósito, o es cualquier browser pegándole a la API?
2. **Autenticar la persona**: ¿quién se está sentando a rendir, y es realmente quien dice ser?

El celular propio resuelve el problema 1 gratis — es el dispositivo de la persona, no hace falta autenticarlo aparte, la sesión larga del login ya cumple ese rol. El atril no: es un dispositivo compartido y anónimo por naturaleza, así que necesita su propio mecanismo de confianza, independiente de quién esté sentado enfrente en cada momento.

## Cómo se distinguen los dos modos

La distinción **no se detecta**, se declara. El backend no mira nada del cliente para adivinar en qué modo está — user-agent, tamaño de pantalla, o cualquier otra huella son datos que manda el propio cliente, y un cliente puede mentir. Es el mismo criterio que ya usamos con la detección de formato de imagen por magic bytes en vez de confiar en el `mimetype` que manda el navegador: no confiar en input que el otro lado controla.

La regla es simple: **si el request de ingreso trae un token de dispositivo válido, es modo atril; si no lo trae, es modo personal.** Sin heurísticas, sin punto intermedio.

### Mecanismo de enrolamiento (atril)

Se propone una entidad `Dispositivo` nueva, siguiendo las convenciones ya establecidas en el resto del backend:

- `nombre` descriptivo (ej. "Atril portería PAE"), para que el backoffice pueda listar y reconocer los dispositivos enrolados.
- `activo`, la misma baja lógica reversible que usan `Puesto`/`CentroCosto` — si un atril sale de servicio o se pierde, se desactiva y su token deja de servir sin borrar el registro.
- Trazabilidad estándar (`created_at/by`, etc.), igual que toda entidad del proyecto.

No es un secreto estático compartido por todos los atriles: cada dispositivo tiene el suyo, generado y revocable de forma independiente. Un secreto único para todos los atriles no se podría revocar sin romper a los demás.

**Alta**: una pantalla nueva "Dispositivos" en el backoffice (mismo patrón que el resto del ABM — no hace falta diseñarla en detalle acá, la Story 5 la construye). Al crear un dispositivo, el backend genera el token con `crypto.randomBytes(32).toString('hex')` — criptográficamente seguro. **Nunca** `Math.random()`, que no es apto para nada relacionado a seguridad porque su salida es predecible.

**Mostrado una sola vez**: el token se ve en pantalla al crearlo y nunca más — mismo patrón que un personal access token de GitHub. Si se pierde, no se recupera, se rota (se genera uno nuevo y el viejo queda inválido).

**Cómo llega al dispositivo**: pedirle a alguien que tipee 64 caracteres hexadecimales en un atril es garantía de error de transcripción. En su lugar, el backoffice renderiza el token como un link de enrolamiento (`/enrolar?token=XXXX`) codificado en un QR. Se escanea desde la tablet, la app lee el token del query param, lo guarda en `localStorage` y limpia la URL para que el token no quede visible en el historial del navegador. El link suelto (sin QR) queda como fallback si el escaneo por algún motivo no anda.

**Cómo se guarda**: el token se persiste hasheado, igual que se va a hacer con el PIN — pero con **SHA-256, no bcrypt**. bcrypt agrega una sal aleatoria distinta a cada hash a propósito, lo cual es la razón por la que sirve para contraseñas de personas: impide un ataque de diccionario precomputado. Pero esa misma sal hace que no se pueda buscar "¿qué fila tiene este hash?" directo por índice — hay que recorrer todas las filas y comparar una por una. Un token de dispositivo no tiene ese problema: ya es aleatorio y de 256 bits, no necesita sal para resistir fuerza bruta, y con SHA-256 el login puede buscar por índice en vez de recorrer la tabla.

**Qué protege y qué no.** Vale la pena dejarlo explícito: robar el token de un atril no le da a nadie más ventaja que la que ya tenía. El token vive en `localStorage`, así que alguien con acceso físico al dispositivo podría extraerlo — pero lo único que ese token habilita es *ver la pantalla de ingreso en modo atril*. El modo atril es, de hecho, **más restrictivo** que el personal (sesión corta, sin "recordarme", ver más abajo). Para rendir una evaluación en nombre de alguien se sigue necesitando su DNI y su PIN, que el token de dispositivo no revela ni reemplaza.

### Celular propio

Acá no aplica el mismo mecanismo, porque no hay un conjunto cerrado de dispositivos para pre-registrar — cualquier persona con la nómina puede entrar desde el celular que tenga. No hace falta un token de enrolamiento aparte: el "token de dispositivo" del modo personal es directamente el JWT que el backend ya emite al loguearse con DNI + PIN. Ese JWT no restringe nada (no es la señal que distingue el modo atril del personal); solo le ahorra a la persona volver a loguearse cada vez.

## Manejo de sesión, distinto por modo

- **Atril**: la sesión muere al terminar la evaluación. Sin "recordarme". Timeout corto de inactividad — si alguien se levanta sin cerrar sesión (se olvida, lo llaman), la siguiente persona no puede quedar rindiendo como si fuera la anterior.
- **Celular propio**: sesión larga, con "recordarme". Es el dispositivo de la persona, no hay motivo para hacerla loguearse todo el tiempo.

## Requisitos técnicos no negociables

Estos dos puntos no dependen de lo que se decida en la reunión con Eduardo — son mínimos de seguridad para cualquier variante del diseño:

- **El PIN se guarda hasheado** (bcrypt o argon2), nunca en texto plano. Es la misma razón por la que ya no se acepta guardar contraseñas en claro en ningún sistema serio: si la base se filtra, un PIN en texto plano es una lista de contraseñas de acceso lista para usar.
- **Rate limiting / bloqueo tras N intentos fallidos.** Un PIN de 4 dígitos tiene 10.000 combinaciones posibles. Sin límite de intentos, un script prueba las 10.000 en minutos. Esto es más urgente todavía en el modo atril, donde el dispositivo compartido hace más tentador probar suerte con el DNI de un compañero.

## Preguntas abiertas para la reunión con Eduardo

Estas tres decisiones no se toman en este documento porque el costo operativo de cada opción recae directamente sobre HSE/coordinadores, no sobre el equipo de desarrollo:

1. **Cómo se crea el PIN la primera vez.** La nómina se carga desde el Excel de Eduardo (Story 3) y ahí no hay ningún campo de PIN.
   - **Opción A — PIN inicial derivado del DNI + cambio obligatorio en el primer ingreso.** Barato de implementar y no requiere que nadie haga nada persona por persona, pero los primeros días cada PIN es predecible (es literalmente el DNI, o una función simple de él) hasta que la persona lo cambia — y no hay garantía de que lo cambie rápido si nadie se lo exige activamente.
   - **Opción B — lo setea un coordinador, persona por persona.** Más seguro desde el primer momento, pero es trabajo manual que escala con el tamaño de la nómina, y alguien tiene que hacerlo antes de que cada persona pueda rendir por primera vez.
2. **Qué pasa si alguien se olvida el PIN.** Hoy no existe ninguna pantalla de backoffice para resetear un PIN. Hay que decidir quién tiene permiso para resetearlo (¿cualquier coordinador? ¿solo HSE?) y qué pasa inmediatamente después del reset — ¿vuelve a la Opción A del punto anterior (PIN derivado + cambio obligatorio), o el coordinador lo genera a mano en el momento?
3. **Requisitos formales de ISO 9001 sobre trazabilidad de quién rindió.** Si existe algún requisito puntual del estándar sobre cómo se prueba la identidad de quien completó una evaluación, puede cambiar el nivel de evidencia que este mecanismo tiene que dejar (por ejemplo, si alcanza con loguear DNI + timestamp, o si hace falta algo más). Vale la pena preguntarlo antes de cerrar el diseño del lado del audit trail.

## Pendiente de implementar (cuando la reunión responda)

Estimación gruesa, para dimensionar la Story 5 y lo que venga después:

| Pieza | Qué implica | Estimación |
|---|---|---|
| Campo de PIN en el modelo | Columna hasheada en `Usuario` (o `Vinculacion`, a definir), + el flujo de creación que resuelva la reunión | 1–2 pts |
| Entidad `Dispositivo` + pantalla de enrolamiento con QR | Migración, ABM básico en el backoffice, generación de token, render del QR | 2–3 pts |
| Endpoint de ingreso | Recibe DNI + PIN (+ token de dispositivo opcional), valida, distingue modo, emite sesión con el timeout que corresponda | 2 pts |
| Pantalla de reseteo de PIN en el backoffice | Depende de la respuesta a la pregunta abierta 2 | 1–2 pts |
| Rate limiting | Contador de intentos fallidos por usuario (y probablemente por dispositivo en el modo atril), con bloqueo temporal | 1–2 pts |

Total aproximado: 7–11 pts, repartidos entre esta story de infraestructura y la Story 5 (que consume el endpoint de ingreso).
