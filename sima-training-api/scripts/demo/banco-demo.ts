// El contenido del banco de la demo: 3 bases de conocimiento con su escala de
// niveles y sus preguntas.
//
// Son datos, no lógica — el que siembra es sembrar-contenido.ts.
//
// Por qué 8 preguntas por nivel y no 3: el examen sortea 3 preguntas
// (`PREGUNTAS_POR_EXAMEN` en tablet.service.ts) de todo el pool que trajo el
// criterio. Con 8 por nivel, dos alumnos del mismo módulo casi nunca ven el
// mismo examen, y el reintento después de desaprobar tampoco repite las mismas
// tres — que es justo lo que se muestra en el paso 11 del guion.
//
// Sólo VERDADERO_FALSO y OPCION_MULTIPLE: OPCIONES_IMAGEN necesita subir
// archivos (no se puede sembrar sin storage) y TEXTO_LIBRE está en el enum pero
// no lo corrige `corregir.ts`, así que una pregunta de ese tipo nunca se podría
// aprobar.

import { TipoPregunta } from '@prisma/client';

export interface PreguntaDemo {
  texto: string;
  tipo: TipoPregunta;
  opciones?: string[];
  respuestaCorrecta: string;
}

export interface NivelDemo {
  nombre: string;
  preguntas: PreguntaDemo[];
}

export interface BaseDemo {
  nombre: string;
  codigo: string;
  descripcion: string;
  fuente: string;
  niveles: NivelDemo[];
}

// Atajos para que las listas de abajo se lean como preguntas y no como JSON.
const vf = (texto: string, respuestaCorrecta: 'Verdadero' | 'Falso'): PreguntaDemo => ({
  texto,
  tipo: TipoPregunta.VERDADERO_FALSO,
  respuestaCorrecta,
});

// La correcta es SIEMPRE la primera opción de la lista. El orden en que se
// muestran no depende de esto (el frontend las renderiza como vienen), pero
// tenerlas siempre primero hace obvio de un vistazo cuál es la correcta al leer
// este archivo, y evita el error de tipear una respuesta que no coincide con
// ninguna opción — que el backend rechaza.
const mc = (texto: string, opciones: string[]): PreguntaDemo => ({
  texto,
  tipo: TipoPregunta.OPCION_MULTIPLE,
  opciones,
  respuestaCorrecta: opciones[0],
});

export const BASES_DEMO: BaseDemo[] = [
  {
    nombre: 'Seguridad Operativa',
    codigo: 'SEG',
    descripcion:
      'EPP, herramientas manuales y eléctricas, trabajo en altura, trabajo en caliente y aislamiento de energía. No incluye gestión de residuos ni manejo defensivo.',
    fuente: 'Manual HSE Ingeniería SIMA — Rev. 3 (2026)',
    niveles: [
      {
        nombre: 'Básico',
        preguntas: [
          vf('Es obligatorio usar casco en todas las áreas operativas de planta.', 'Verdadero'),
          vf('Un EPP dañado o vencido puede seguir usándose hasta terminar la jornada.', 'Falso'),
          vf(
            'Está permitido remover la protección del disco de la amoladora para trabajar más rápido.',
            'Falso',
          ),
          vf('El protector facial reemplaza a las antiparras de seguridad.', 'Falso'),
          mc('¿Cuál es el EPP mínimo obligatorio para ingresar a planta?', [
            'Casco, botines de seguridad y ropa de trabajo ignífuga',
            'Solamente casco',
            'Ropa de calle y calzado cerrado',
            'Ninguno, es opcional según el sector',
          ]),
          mc('¿Qué protección es obligatoria al operar una amoladora angular?', [
            'Antiparras y protector facial',
            'Solamente guantes de descarne',
            'Solamente protección auditiva',
            'Ninguna, si el disco es nuevo',
          ]),
          mc('¿Qué hay que hacer antes de usar una herramienta eléctrica portátil?', [
            'Revisar cable, ficha y que la protección esté colocada',
            'Solamente comprobar que encienda',
            'Nada, el pañol ya la revisó',
            'Lijar los contactos de la ficha',
          ]),
          mc('¿Quién debe reportar una condición insegura en el área de trabajo?', [
            'Cualquier persona que la detecte',
            'Solamente el supervisor del área',
            'Solamente el técnico de HSE',
            'Solamente el jefe de obra',
          ]),
        ],
      },
      {
        nombre: 'Intermedio',
        preguntas: [
          vf(
            'Un trabajo en caliente en zona con posible presencia de gases inflamables requiere permiso de trabajo previo.',
            'Verdadero',
          ),
          vf(
            'El arnés de seguridad puede anclarse a cualquier cañería que esté al alcance.',
            'Falso',
          ),
          vf(
            'La medición de gases previa a un trabajo en caliente pierde validez si el trabajo se interrumpe por varias horas.',
            'Verdadero',
          ),
          vf('Un andamio sin tarjeta de habilitación puede usarse igual si se ve firme.', 'Falso'),
          mc('Antes de un trabajo en altura, ¿qué se verifica primero?', [
            'El punto de anclaje y el estado del arnés',
            'Solamente el pronóstico del clima',
            'La cantidad de personal disponible',
            'Nada, si la tarea es corta',
          ]),
          mc('¿A partir de qué altura se considera trabajo en altura y exige protección contra caídas?', [
            '1,80 metros',
            '5 metros',
            '10 metros',
            'No hay una altura definida',
          ]),
          mc('¿Qué se hace si durante un trabajo en caliente cambia la dirección del viento?', [
            'Se detiene la tarea y se reevalúan las condiciones',
            'Se continúa, el permiso ya está firmado',
            'Se moja la zona y se sigue',
            'Se avisa al final de la jornada',
          ]),
          mc('¿Qué debe acompañar siempre a un permiso de trabajo en caliente?', [
            'Vigía de fuego y extintor en el lugar',
            'Solamente la firma del operario',
            'Un parte diario de producción',
            'La orden de compra del material',
          ]),
        ],
      },
      {
        nombre: 'Avanzado',
        preguntas: [
          vf(
            'El aislamiento de energía (Lock Out / Tag Out) es obligatorio antes de intervenir un equipo.',
            'Verdadero',
          ),
          vf(
            'Un candado de bloqueo puede ser retirado por cualquier operario si el titular ya se retiró del turno.',
            'Falso',
          ),
          vf(
            'Antes de dar por cerrado un LOTO hay que verificar que nadie haya quedado en la zona de riesgo.',
            'Verdadero',
          ),
          vf('La energía residual de un sistema hidráulico se disipa sola al cortar el suministro.', 'Falso'),
          mc('En un bloqueo LOTO, ¿quién retira el candado?', [
            'La misma persona que lo colocó',
            'El supervisor de turno',
            'El primero que necesite el equipo',
            'El operador de la sala de control',
          ]),
          mc('¿Qué energías hay que considerar al aislar un equipo?', [
            'Eléctrica, hidráulica, neumática, térmica y gravitatoria',
            'Solamente la eléctrica',
            'Solamente la eléctrica y la neumática',
            'Solamente las que tengan tablero propio',
          ]),
          mc('¿Cuál es el paso final de un procedimiento de bloqueo?', [
            'Verificar energía cero probando el arranque del equipo',
            'Firmar el permiso y retirarse',
            'Avisar por radio al jefe de obra',
            'Colgar la tarjeta y comenzar la tarea',
          ]),
          mc('¿Qué se hace si un equipo bloqueado necesita ser probado a mitad de la tarea?', [
            'Se retira el bloqueo con el procedimiento completo y se vuelve a aplicar después',
            'Se saca el candado un momento y se vuelve a poner',
            'Se prueba con el candado puesto',
            'Se pide autorización verbal y se prueba',
          ]),
        ],
      },
    ],
  },

  {
    nombre: 'Reglas de Oro Oil & Gas',
    codigo: 'ORO',
    descripcion:
      'Las reglas de oro de la industria: espacios confinados, izaje y maniobras, permisos de trabajo, aislamiento de energía y manejo defensivo en yacimiento. No incluye el detalle técnico de cada tarea, que vive en Seguridad Operativa.',
    fuente: 'Reglas de Oro — Estándar de la operación (2026)',
    niveles: [
      {
        nombre: 'Básico',
        preguntas: [
          vf('Ingresar a un espacio confinado exige permiso y medición de atmósfera previa.', 'Verdadero'),
          vf('Se puede circular por debajo de una carga suspendida si el operador de la grúa te vio.', 'Falso'),
          vf('El cinturón de seguridad es obligatorio en todo vehículo dentro del yacimiento.', 'Verdadero'),
          vf('Se puede usar el celular manejando si la llamada es de trabajo.', 'Falso'),
          mc('¿Cuál de las siguientes NO es una Regla de Oro de la industria?', [
            'Estacionar en cualquier lugar disponible',
            'Aislamiento de energía antes de intervenir',
            'Trabajo en altura con protección contra caídas',
            'Ingreso a espacios confinados con permiso',
          ]),
          mc('¿Cuál es la velocidad máxima habitual dentro de un yacimiento?', [
            '40 km/h',
            '80 km/h',
            '100 km/h',
            'No hay límite en caminos internos',
          ]),
          mc('¿Qué se hace si una Regla de Oro no se puede cumplir en una tarea?', [
            'Se detiene la tarea y se escala al supervisor',
            'Se cumple lo que se pueda y se sigue',
            'Se anota en el parte y se continúa',
            'Se pide permiso verbal a un compañero',
          ]),
          mc('¿Quién tiene autoridad para detener un trabajo inseguro?', [
            'Cualquier persona, sin importar su jerarquía',
            'Solamente el jefe de obra',
            'Solamente el gerente de SSMAC',
            'Solamente el cliente',
          ]),
        ],
      },
      {
        nombre: 'Avanzado',
        preguntas: [
          vf(
            'Un permiso de trabajo vence al terminar el turno para el que fue emitido.',
            'Verdadero',
          ),
          vf(
            'El vigía de un espacio confinado puede ingresar a rescatar a un compañero si lo ve descompensado.',
            'Falso',
          ),
          vf('En una maniobra de izaje crítica hace falta un plan de izaje escrito.', 'Verdadero'),
          vf('Una eslinga con hilos cortados puede usarse si la carga es liviana.', 'Falso'),
          mc('¿Cuál es la función del vigía en un espacio confinado?', [
            'Permanecer afuera, mantener contacto y dar la alarma',
            'Entrar con el operario para asistirlo',
            'Controlar el avance de la tarea desde adentro',
            'Firmar el permiso al finalizar',
          ]),
          mc('¿Qué invalida un permiso de trabajo ya emitido?', [
            'Un cambio en las condiciones o en el alcance de la tarea',
            'Que cambie el turno del supervisor',
            'Que la tarea demore menos de lo previsto',
            'Nada, una vez firmado vale hasta terminar',
          ]),
          mc('Antes de una maniobra de izaje, ¿qué se verifica?', [
            'Peso de la carga, capacidad del equipo, estado de accesorios y zona despejada',
            'Solamente el peso de la carga',
            'Solamente que el operador tenga licencia',
            'Solamente el pronóstico de viento',
          ]),
          mc('¿Qué se hace ante una atmósfera con menos de 19,5% de oxígeno?', [
            'No se ingresa: se ventila y se vuelve a medir',
            'Se ingresa con barbijo',
            'Se ingresa por menos de 15 minutos',
            'Se ingresa acompañado',
          ]),
        ],
      },
    ],
  },

  {
    nombre: 'Medio Ambiente y Residuos',
    codigo: 'AMB',
    descripcion:
      'Clasificación y disposición de residuos, contención y respuesta ante derrames, y cuidado del suelo y el agua en yacimiento. No incluye seguridad de las personas, que vive en Seguridad Operativa.',
    fuente: 'Procedimiento de Gestión Ambiental Ingeniería SIMA — Rev. 2 (2026)',
    niveles: [
      {
        nombre: 'Básico',
        preguntas: [
          vf(
            'Los residuos peligrosos se descartan en el mismo contenedor que los residuos comunes.',
            'Falso',
          ),
          vf('Un trapo embebido en hidrocarburo es un residuo peligroso.', 'Verdadero'),
          vf('Los contenedores de residuos deben estar identificados y tapados.', 'Verdadero'),
          vf('El agua de lluvia acumulada en un recinto con hidrocarburo puede volcarse al suelo.', 'Falso'),
          mc('¿Qué indica el color de un contenedor de residuos?', [
            'La categoría de residuo que puede recibir',
            'La empresa que lo provee',
            'El tamaño del contenedor',
            'La frecuencia con que se retira',
          ]),
          mc('¿Dónde se descarta un filtro de aceite usado?', [
            'En el contenedor de residuos peligrosos',
            'En el contenedor de residuos comunes',
            'En el contenedor de chatarra',
            'En cualquiera, si está escurrido',
          ]),
          mc('¿Qué se hace con un envase vacío de producto químico?', [
            'Se gestiona como residuo peligroso, no se reutiliza',
            'Se reutiliza para guardar agua',
            'Se descarta como residuo común',
            'Se entierra en el predio',
          ]),
          mc('¿Cuál es el primer paso ante un derrame pequeño de hidrocarburo?', [
            'Contenerlo para que no se extienda y dar aviso',
            'Taparlo con tierra y seguir trabajando',
            'Lavarlo con agua a presión',
            'Esperar a que se evapore',
          ]),
        ],
      },
      {
        nombre: 'Avanzado',
        preguntas: [
          vf(
            'Todo movimiento de residuos peligrosos fuera del yacimiento requiere manifiesto de transporte.',
            'Verdadero',
          ),
          vf('Un derrame contenido dentro del recinto impermeabilizado no necesita reportarse.', 'Falso'),
          vf(
            'Los kits antiderrame deben reponerse inmediatamente después de usarse.',
            'Verdadero',
          ),
          vf('El suelo contaminado retirado puede disponerse en cualquier escombrera.', 'Falso'),
          mc('¿Qué función cumple el recinto de contención de un tanque?', [
            'Retener el producto ante una pérdida y evitar que llegue al suelo',
            'Proteger el tanque del viento',
            'Facilitar el acceso para mantenimiento',
            'Aislar térmicamente el tanque',
          ]),
          mc('¿Qué documenta el manifiesto de transporte de residuos peligrosos?', [
            'Origen, tipo, cantidad, transportista y destino final del residuo',
            'Solamente el peso total',
            'Solamente la empresa generadora',
            'Solamente la fecha de retiro',
          ]),
          mc('Ante un derrame que alcanza un curso de agua, ¿qué corresponde?', [
            'Activar el plan de emergencia ambiental y notificar de inmediato',
            'Contenerlo y reportarlo al final del turno',
            'Registrarlo en el parte diario',
            'Esperar la evaluación del área ambiental',
          ]),
          mc('¿Qué se hace con el material absorbente usado en un derrame?', [
            'Se gestiona como residuo peligroso',
            'Se lava y se reutiliza',
            'Se descarta como residuo común',
            'Se incinera en el lugar',
          ]),
        ],
      },
    ],
  },
];
