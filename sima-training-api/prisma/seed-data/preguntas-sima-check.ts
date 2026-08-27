// ARCHIVO GENERADO — no editar a mano.
//
// Sale de los cinco Excel de evaluación que usa SIMA CHECK en papel
// (`docs/SIMA - Básico.xlsx`, `- Intermedio`, `- Avanzado`,
// `docs/Sima Check - Reglas de Oro Industria Petrolera.xlsx` y
// `- Módulo Phoenix.xlsx`). En esos Excel la respuesta correcta está PINTADA DE
// VERDE: en la celda con el texto cuando la opción es texto, y en la celda vacía
// que queda debajo de la imagen cuando la opción es una imagen.
//
// Los Excel NO están versionados —el .gitignore los bloquea porque el archivo
// hermano de nómina lleva PII— así que este archivo y las imágenes de
// `seed-assets/preguntas/` son la única copia versionada del contenido. Se
// regenera con `python scripts/contenido/generar.py`, que necesita los Excel en
// `docs/`; el porqué de cada convención (incluidos los tres casos que el Excel
// deja ambiguos) está en `docs/decisiones/preguntas.md`, sección "El contenido
// real: los cinco Excel de SIMA CHECK".
//
// Las imágenes se referencian por NOMBRE DE ARCHIVO dentro de
// `prisma/seed-assets/preguntas/`. El seed las sube por StorageService y
// reemplaza cada nombre por la clave opaca que devuelve, que es lo que termina
// en la base — acá no hay claves de storage ni rutas.

import { TipoPregunta } from '@prisma/client';

export interface PreguntaSeed {
  texto: string;
  tipo: TipoPregunta;
  // OPCION_MULTIPLE: los textos tal cual se muestran.
  // OPCIONES_IMAGEN: nombres de archivo de seed-assets/preguntas/.
  // VERDADERO_FALSO: ausente — las dos opciones las pone el frontend.
  opciones?: string[];
  // Mismo vocabulario que `opciones`: un texto, 'Verdadero'/'Falso', o el
  // nombre de archivo de la imagen correcta.
  respuestaCorrecta: string;
  // Imagen del enunciado (nombre de archivo), si la pregunta la tiene.
  imagen?: string;
}


export const PREGUNTAS: Record<string, PreguntaSeed[]> = {
  'basico': [
    {
      texto: '¿Quiénes deben aplicar las Reglas de Oro de Ingeniería Sima?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo quien ejecuta el trabajo',
        'El Supervisor',
        'El Ref. SSMAC',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'basico-image23.jpg',
    },
    {
      texto: 'Indique de qué regla se trata.',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Prohibido utilizar grúas',
        'Permiso de izaje',
        'Prohibido circular debajo de carga suspendida',
        'Equipo de izaje en movimiento',
      ],
      respuestaCorrecta: 'Prohibido circular debajo de carga suspendida',
      imagen: 'basico-image28.jpg',
    },
    {
      texto: 'La Política de detención de tareas, ¿quién la puede aplicar?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo quien ejecuta el trabajo',
        'Todo el personal',
        'El Ref. SSMAC',
        'El Supervisor',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'basico-image22.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Seguridad Vial',
        'Permiso de trabajo',
        'Excavaciones',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Seguridad Vial',
      imagen: 'basico-image21.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Línea de Fuego',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Línea de Fuego',
      imagen: 'basico-image40.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavaciones',
        'Aislamiento de Energías',
      ],
      respuestaCorrecta: 'Aislamiento de Energías',
      imagen: 'basico-image24.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Prohibido beber y comer',
        'Prohibido tomar agua',
        'Agua no potable',
        'Prohibido el consumo de Alcohol y Drogas',
      ],
      respuestaCorrecta: 'Prohibido el consumo de Alcohol y Drogas',
      imagen: 'basico-image27.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Espacio Confinado',
        'Trabajo en Altura',
        'Excavaciones',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Trabajo en Altura',
      imagen: 'basico-image39.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Elevación y Montaje',
        'Excavaciones',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Elevación y Montaje',
      imagen: 'basico-image25.jpg',
    },
    {
      texto: 'Indique qué Regla corresponde a Excavación y Apertura',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image25.jpg',
        'basico-image1.jpg',
        'basico-image28.jpg',
      ],
      respuestaCorrecta: 'basico-image1.jpg',
    },
    {
      texto: 'Indique qué Regla corresponde a carga suspendida',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image40.jpg',
        'basico-image25.jpg',
        'basico-image28.jpg',
      ],
      respuestaCorrecta: 'basico-image28.jpg',
    },
    {
      texto: 'Indique qué Regla aplica para trabajo con equipos de izaje',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image25.jpg',
        'basico-image40.jpg',
        'basico-image21.jpg',
      ],
      respuestaCorrecta: 'basico-image25.jpg',
    },
    {
      texto: 'Indique qué Regla aplica a Aislamiento de Energías',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image16.jpg',
        'basico-image24.jpg',
        'basico-image21.jpg',
      ],
      respuestaCorrecta: 'basico-image24.jpg',
    },
    {
      texto: 'Indique qué Regla corresponde a Detención de Tarea',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image22.jpg',
        'basico-image28.jpg',
        'basico-image27.jpg',
      ],
      respuestaCorrecta: 'basico-image22.jpg',
    },
    {
      texto: 'Indique qué Regla corresponde a Trabajo en Altura',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image16.jpg',
        'basico-image39.jpg',
        'basico-image25.jpg',
      ],
      respuestaCorrecta: 'basico-image39.jpg',
    },
    {
      texto: 'Indique qué Regla corresponde a Línea de Fuego',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image16.jpg',
        'basico-image25.jpg',
        'basico-image40.jpg',
      ],
      respuestaCorrecta: 'basico-image40.jpg',
    },
    {
      texto: 'Indique qué Regla corresponde a Seguridad Vial',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image21.jpg',
        'basico-image25.jpg',
        'basico-image40.jpg',
      ],
      respuestaCorrecta: 'basico-image21.jpg',
    },
    {
      texto: 'Indique qué Regla corresponde a Permiso de Trabajo',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image21.jpg',
        'basico-image25.jpg',
        'basico-image16.jpg',
      ],
      respuestaCorrecta: 'basico-image16.jpg',
    },
    {
      texto: 'Indique qué Regla corresponde a Prohibición de consumo de Alcohol y Drogas',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image28.jpg',
        'basico-image27.jpg',
        'basico-image22.jpg',
      ],
      respuestaCorrecta: 'basico-image27.jpg',
    },
    {
      texto: 'LÍNEA DE FUEGO: es el lugar donde una persona (o parte de su cuerpo) puede ser impactada, golpeada o atravesada por objetos, materiales o cualquier tipo de energía que se libera repentinamente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'PERMISO DE TRABAJO: es el documento formal que autoriza la realización de una tarea específica y establece los puntos de chequeo para verificar las condiciones y medidas de seguridad que deben seguirse para prevenir accidentes.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'OPERACIONES DE ELEVACIÓN Y MONTAJE: el equipo, los elementos, el operador y los señaleros en una tarea de izaje deben tener certificación vigente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La Política de DETENCIÓN DE TAREA la aplican solo los Ref. SSMAC.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'El orden y la limpieza son factores clave para prevenir accidentes.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Debo utilizar detector de gases con calibración vigente al momento de ingresar a una zona con presencia de gases.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Nunca debemos circular por debajo de la carga suspendida en una maniobra de izaje.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La política de la prohibición del consumo de alcohol y drogas solo se aplica a la conducción de vehículos y equipos.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Ajustar la velocidad a las condiciones climáticas, al estado del camino y a la condición de iluminación es una forma de aplicar Seguridad Vial.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Siempre que suba o baje escaleras debo aplicar la técnica de los tres puntos de apoyo.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Se permite fumar y/o usar cigarrillos electrónicos dentro de los tráileres u oficinas.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'En caso de eventualidades (derrames, accidentes personales, incendio, accidente de tránsito) debo activar el Rol de Emergencias de Ingeniería Sima que aplica a cada sitio.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿En qué tacho debo disponer un residuo METÁLICO libre de hidrocarburo?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image19.jpg',
    },
    {
      texto: '¿En qué tacho debo disponer un residuo BIODEGRADABLE o RECICLABLE libre de hidrocarburo?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image9.jpg',
    },
    {
      texto: '¿En qué tacho debo disponer los residuos CONDICIONADOS o SUELOS CONTAMINADOS?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image11.jpg',
    },
    {
      texto: '¿En qué tacho debo disponer los residuos contaminados con hidrocarburos y productos químicos, como filtros, trapos, guantes, suelo o aceites?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image11.jpg',
    },
    {
      texto: '¿En qué tacho debo disponer la yerba, los restos de comida, los cartones y los envases plásticos libres de hidrocarburos o químicos?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image9.jpg',
    },
    {
      texto: '¿En qué tacho debo disponer los restos de chapa, cobre, bronce y chatarra libres de hidrocarburos?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image19.jpg',
    },
    {
      texto: 'Indique qué significa este pictograma.',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Conducción segura',
        'Regla de los tres puntos de apoyo',
        'Uso de EPP adecuado',
      ],
      respuestaCorrecta: 'Regla de los tres puntos de apoyo',
      imagen: 'basico-image37.jpg',
    },
    {
      texto: 'Debo conocer el Rol de Emergencias y el punto de reunión de cada sitio de trabajo.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Ingeniería Sima prohíbe el uso de vehículos de la empresa para uso personal.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Indique si esta imagen corresponde a la regla de las 3R.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
      imagen: 'basico-image31.png',
    },
    {
      texto: 'Indique cuál es la posición correcta para el levantamiento manual de cargas.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image34.png',
        'basico-image29.png',
      ],
      respuestaCorrecta: 'basico-image29.png',
    },
    {
      texto: 'Indique en cuál de las imágenes ve riesgo eléctrico o posibilidad de incendio.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image26.jpg',
        'basico-image35.jpg',
      ],
      respuestaCorrecta: 'basico-image26.jpg',
    },
    {
      texto: 'Indique cuál es una postura ergonómicamente correcta.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image30.jpg',
        'basico-image36.jpg',
      ],
      respuestaCorrecta: 'basico-image30.jpg',
    },
    {
      texto: 'Indique cuál de estos no se considera un residuo peligroso.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image20.jpg',
        'basico-image15.jpg',
        'basico-image12.jpg',
      ],
      respuestaCorrecta: 'basico-image12.jpg',
    },
    {
      texto: 'Indicar de qué se trata la siguiente imagen:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Obligatorio uso de protección auditiva',
        'Zona apta para uso de auriculares',
        'Prohibido escuchar música',
        'Ninguna de las anteriores',
      ],
      respuestaCorrecta: 'Obligatorio uso de protección auditiva',
      imagen: 'basico-image33.jpg',
    },
    {
      texto: 'Indicar de qué se trata la siguiente imagen:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Obligatorio uso de guantes de protección',
        'Prohibido aplaudir',
        'Obligación de saludar',
        'Salude al ingresar',
      ],
      respuestaCorrecta: 'Obligatorio uso de guantes de protección',
      imagen: 'basico-image32.jpg',
    },
    {
      texto: 'El término ralentí hace referencia al régimen mínimo de revoluciones al cual se puede mantener estable el funcionamiento de un motor de combustión interna sin requerir aceleración. Se produce cuando el vehículo está detenido con el motor en marcha.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'El ralentí no genera ningún inconveniente al ambiente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Indicar de qué se trata la siguiente imagen:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Punto de Reunión',
        'Estacionamiento',
        'Atención diagonales',
        'Plaza',
      ],
      respuestaCorrecta: 'Punto de Reunión',
      imagen: 'basico-image38.jpg',
    },
    {
      texto: '¿Cuál no es una energía renovable?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image13.jpg',
        'basico-image18.jpg',
        'basico-image14.jpg',
      ],
      respuestaCorrecta: 'basico-image14.jpg',
    },
    {
      texto: '¿Qué es un EPP?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Elementos de producción personal',
        'Equipos de prevención personal',
        'Equipos de producción personal',
        'Elementos de protección personal',
      ],
      respuestaCorrecta: 'Elementos de protección personal',
    },
    {
      texto: 'Para realizar un correcto levantamiento manual de cargas debemos utilizar la fuerza de las piernas doblando las rodillas.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'El uso de EPP',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Queda sujeto a mi elección',
        'Ninguna de las anteriores',
        'Queda sujeto a la solicitud del supervisor',
        'Es obligatorio en todo momento',
      ],
      respuestaCorrecta: 'Es obligatorio en todo momento',
    },
    {
      texto: 'Es obligatorio contar con un análisis de riesgo de las tareas antes de realizar cualquier actividad.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Cuál es la primera acción que debe realizar el observador ante un cuasi accidente?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Señalizar la zona',
        'Dar aviso',
        'Nada',
        'Ninguna de las anteriores',
      ],
      respuestaCorrecta: 'Dar aviso',
    },
    {
      texto: 'Los vehículos de la empresa cuentan con un sistema de arranque de identificación obligatoria, por lo cual a cada conductor se le asigna una llave de uso estrictamente personal e intransferible denominada llave PIN.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Se prohíbe el uso de vehículos de la empresa fuera de los horarios laborales y para uso personal.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Según el procedimiento de Mantenimiento de vehículos y equipos, ¿es obligatorio realizar el check list de forma mensual?',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Toda contravención de tránsito deberá ser asumida por la persona que conduzca la unidad en ese momento y lugar.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Es necesario que todo personal nuevo en un Sector, Obra o Servicio reciba una inducción en el sitio de trabajo antes de comenzar las actividades.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Al transportar manualmente una carga es importante poder visualizar siempre el camino a recorrer.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Para la ley de tránsito, las bicicletas son consideradas un vehículo más.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
  ],
  'intermedio': [
    {
      texto: 'Indique qué símbolo nos indica la eficiencia energética de un electrodoméstico.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'intermedio-image2.jpg',
        'intermedio-image3.jpg',
        'intermedio-image4.jpg',
      ],
      respuestaCorrecta: 'intermedio-image4.jpg',
    },
    {
      texto: 'Indique qué significan estas imágenes',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Conducción Segura',
        'Avanzar, Rotonda, Giro',
        'Clasificación de residuos',
        'Reducir, Reutilizar, Reciclar',
      ],
      respuestaCorrecta: 'Reducir, Reutilizar, Reciclar',
      imagen: 'intermedio-image6.jpg',
    },
    {
      texto: '¿Quiénes deben aplicar las Reglas de Oro de Ingeniería Sima?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo quien ejecuta el trabajo',
        'El Supervisor',
        'El Ref. SSMAC',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'basico-image23.jpg',
    },
    {
      texto: 'La Política de detención de tareas, ¿quién la puede aplicar?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo quien ejecuta el trabajo',
        'Todo el personal',
        'El Ref. SSMAC',
        'El Supervisor',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'basico-image22.jpg',
    },
    {
      texto: 'Las Reglas de Oro para trabajo en equipos y sistemas eléctricos sin tensión son:\n1. Corte visible\n2. Enclavamiento y bloqueo\n3. Verificación de ausencia de tensión\n4. Puesta a tierra y en cortocircuito\n5. Señalización de la zona',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Indique qué significa esta imagen',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Conducción segura',
        'Medición de puesta a tierra',
        'La regla de los 5 puntos de apoyo',
        'Las 5 Reglas de Oro para trabajo sin tensión',
      ],
      respuestaCorrecta: 'Las 5 Reglas de Oro para trabajo sin tensión',
      imagen: 'intermedio-image9.jpg',
    },
    {
      texto: 'Indique qué significa esta imagen',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Cadena de supervivencia',
        'Denuncia a la ART',
      ],
      respuestaCorrecta: 'Cadena de supervivencia',
      imagen: 'intermedio-image10.jpg',
    },
    {
      texto: 'Indique qué significa esta imagen',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'RCP',
        'GPS',
      ],
      respuestaCorrecta: 'RCP',
      imagen: 'intermedio-image11.jpg',
    },
    {
      texto: 'Es necesario que todo personal nuevo en un Sector, Obra o Servicio reciba una inducción en el sitio de trabajo antes de comenzar las actividades.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En un ESPACIO CONFINADO debo verificar y registrar las condiciones de la atmósfera mediante equipos de medición calibrados y personal competente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Indique qué significa esta imagen',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Puntos ciegos en equipos pesados',
        'Iluminación auxiliar de los equipos',
      ],
      respuestaCorrecta: 'Puntos ciegos en equipos pesados',
      imagen: 'intermedio-image12.jpg',
    },
    {
      texto: 'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar las presiones residuales.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Está PROHIBIDO retirar o remover dispositivos de bloqueo y/o etiquetas que no fueron colocados por mí.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Qué es el ralentí?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Hacer aceleradas cortas mientras espero la habilitación del semáforo',
        'Dejar el vehículo detenido con el motor en marcha',
        'No cumplir con los mantenimientos programados',
        'Parar y arrancar el vehículo en cada detención',
      ],
      respuestaCorrecta: 'Dejar el vehículo detenido con el motor en marcha',
      imagen: 'intermedio-image13.png',
    },
    {
      texto: 'El ralentí genera impacto en el ambiente y desgaste en el motor.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Todo producto químico debe estar etiquetado según el SGA.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Estos pictogramas corresponden a los productos químicos según el SGA (Sistema Globalmente Armonizado).',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
      imagen: 'intermedio-image5.jpg',
    },
    {
      texto: 'Una contravención de tránsito es una conducta antijurídica penada por la Ley Nacional de Tránsito, y debe ser asumida por la persona que conduzca la unidad en ese momento y lugar.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Cuál es el propósito de realizar simulacros en los sitios de trabajo?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Para entretener',
        'Para conocer cómo activar el rol de emergencias',
        'Para gastar tiempo',
        'Para ser bombero',
      ],
      respuestaCorrecta: 'Para conocer cómo activar el rol de emergencias',
    },
    {
      texto: 'Cuando un vehículo viene de frente por el mismo carril, debemos aplicar la regla de las cuatro "M":\n1- Mirar la ruta\n2- Mantener la derecha\n3- Mermar la velocidad\n4- Maniobrar hacia afuera de la ruta',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Estas son las cuatro prohibiciones cuando utilizamos un vehículo de la empresa:\n1- Ceder la conducción a personal ajeno a la empresa\n2- Transportar a personas ajenas a la empresa\n3- Ceder la llave PIN o de ID de arranque\n4- Uso personal del vehículo',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Quiénes deben confeccionar una tarjeta de observación si se advierte un desvío?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo quien ejecuta el trabajo',
        'Todo el personal',
        'El Ref. SSMAC',
        'El Supervisor',
      ],
      respuestaCorrecta: 'Todo el personal',
    },
    {
      texto: 'Confeccionar tarjetas de observación, participar en la confección de un IPER o proponer una oportunidad de mejora son formas de Participación y Consulta de los Trabajadores.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Quién debe asegurarse de que esta premisa se cumpla?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'El que ejecuta el trabajo',
        'Todo el personal',
        'El Referente SSMAC',
        'El Supervisor',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'intermedio-image14.jpg',
    },
    {
      texto: '¿De qué se trata esta Pirámide?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Pirámide de la Vida',
        'Pirámide de Keops',
        'Pirámide Alimenticia',
        'Pirámide de Bird',
      ],
      respuestaCorrecta: 'Pirámide de Bird',
      imagen: 'intermedio-image15.jpg',
    },
    {
      texto: '¿Quién debe identificar condiciones y acciones inseguras?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'El que ejecuta el trabajo',
        'El Supervisor',
        'El Referente SSMAC',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'intermedio-image15.jpg',
    },
  ],
  'avanzado': [
    {
      texto: '¿Quiénes deben aplicar las Reglas de Oro de Ingeniería Sima?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo quien ejecuta el trabajo',
        'El Supervisor',
        'El Ref. SSMAC',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'basico-image23.jpg',
    },
    {
      texto: 'La Política de detención de tareas, ¿quién la puede aplicar?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo quien ejecuta el trabajo',
        'Todo el personal',
        'El Ref. SSMAC',
        'El Supervisor',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'basico-image22.jpg',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión: "Cumplir con los requisitos y expectativas de sus clientes y demás partes interesadas".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión: "Concientizar a todos los integrantes de la organización para dar cumplimiento a esta Política".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión: "Aplicar los requisitos legales, las prácticas de trabajo seguro y la protección ambiental solo cuando el cliente los solicite".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión: "Promover la eliminación de peligros y la reducción de riesgos en la gestión de Seguridad y Salud en el Trabajo".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión: "Cumplir con los requisitos legales y otros requisitos aplicables solo cuando sea posible".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Según la Política de Ingeniería Sima, "las prácticas seguras de trabajo son responsabilidad…"',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'de quien ejecuta el trabajo',
        'de todo el personal',
        'del Referente SSMAC',
        'del Supervisor',
      ],
      respuestaCorrecta: 'de todo el personal',
    },
    {
      texto: 'Nuestra Visión es "ser la opción más confiable en la producción de hidrocarburos y en la generación de otras formas de energía".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Nuestra Visión es "ser la empresa mejor vista y más optimista del mercado".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Nuestra Misión es "ofrecer ventajas competitivas a nuestros clientes —calidad, bajos costos y rapidez— basadas en los criterios máximos de la industria en cuanto a salud, seguridad, medio ambiente y responsabilidad social".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Este es el alcance que Ingeniería Sima tiene certificado: "Ingeniería, ejecución, montaje y puesta en marcha de proyectos constructivos tipo llave en mano. Servicio de movimiento de suelos. Servicio de operación y mantenimiento de yacimientos de petróleo y gas".',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La ISO 14001 es una norma internacional que proporciona orientación respecto a cómo gestionar los aspectos medioambientales de una organización.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La ISO 9001 es una norma internacional que establece los requisitos para un Sistema de Gestión de la Calidad.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La norma internacional ISO 14001 determina los requisitos para un Sistema de Gestión de la Calidad.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'La ISO 45001 es una norma internacional que especifica los requisitos para un Sistema de Gestión de Salud y Seguridad Ocupacional (SST).',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La ISO 14001 es una norma internacional que establece los requisitos para un Sistema de Gestión de Salud y Seguridad Ocupacional (SST).',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'PELIGRO: es un agente (material o energía) con potencial para provocar daños en las personas, las instalaciones, los equipos, los materiales y el medio ambiente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'RIESGO: es la combinación de la probabilidad de ocurrencia y la consecuencia de un determinado evento peligroso.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Para qué se utiliza esta herramienta?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'No es una herramienta',
        'Optimizador de tiempos',
        'Ruleta para asignación de trabajos',
        'Para Identificar los Peligros',
      ],
      respuestaCorrecta: 'Para Identificar los Peligros',
      imagen: 'avanzado-image4.jpg',
    },
    {
      texto: '¿Qué significa el término Ergonomía?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Elementos de producción personal',
        'Equipos de prevención personal',
        'Capacitar al personal en el uso adecuado de EPP',
        'Diseñar espacios de trabajo para minimizar la fatiga y el estrés físico',
      ],
      respuestaCorrecta: 'Diseñar espacios de trabajo para minimizar la fatiga y el estrés físico',
    },
    {
      texto: 'Cuando se realicen trabajos fuera de los horarios habituales, fines de semana o feriados, el supervisor o jefe de obra debe enviar una comunicación a trabajonorutinario@sima.com.ar indicando la actividad que se va a realizar y el personal afectado. Ese mail informa a Dirección, Gerencias, SSMAC y RRHH.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Si se va a realizar un trabajo fuera de los horarios habituales o fines de semana no es necesario dar aviso: solo se deben pasar las horas a RRHH.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Es un objetivo disminuir los mails que la comunidad envía a comomanejo@sima.com.ar por causas y conductas impropias de nuestros conductores.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Cómo puedo mejorar mi conducta proactiva?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Cumpliendo solo con lo que me solicita el cliente',
        'Confeccionando tarjetas de observación, auditorías de campo y visitas gerenciales',
      ],
      respuestaCorrecta: 'Confeccionando tarjetas de observación, auditorías de campo y visitas gerenciales',
    },
    {
      texto: 'Es responsabilidad de los Jefes de Obra, Jefes de Servicio y Referentes de SSMAC destinar un espacio de tiempo para realizar una inducción en el sitio de trabajo antes de que el nuevo empleado comience las actividades, dejando registro de ella.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En actividades de EXCAVACIÓN o ZANJEO en zonas de baterías o plantas no es necesario realizar la geodetección de interferencias.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Una contravención de tránsito es una conducta antijurídica penada por la Ley Nacional de Tránsito, y debe ser asumida por la persona que conduzca la unidad en ese momento y lugar.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'El procedimiento de Gestión de la Organización define las herramientas de las que dispone la empresa para la Participación y Consulta de los Trabajadores (confección y revisión de los IPER, tarjetas de observación, participación en la confección de procedimientos e instructivos, Sima Check, etc.).',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Estas son las cuatro prohibiciones cuando utilizamos un vehículo de la empresa:\n1- Ceder la conducción a personal ajeno a la empresa\n2- Transportar a personas ajenas a la empresa\n3- Ceder la llave PIN o de ID de arranque\n4- Uso personal del vehículo',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿De qué se trata esta Pirámide?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Pirámide de la Vida',
        'Pirámide de Keops',
        'Pirámide Alimenticia',
        'Pirámide de Bird',
      ],
      respuestaCorrecta: 'Pirámide de Bird',
      imagen: 'intermedio-image15.jpg',
    },
    {
      texto: '¿Qué hace Ingeniería Sima en la industria?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Hace Obras de ductos, movimiento de suelos y construcción de plantas',
        'Gestiona Proyectos',
        'Presta Servicios de O&M para la industria petrolera',
        'Ejecuta Obras y ofrece Servicios enfocados en satisfacer las necesidades de nuestros clientes',
      ],
      respuestaCorrecta: 'Ejecuta Obras y ofrece Servicios enfocados en satisfacer las necesidades de nuestros clientes',
      imagen: 'avanzado-image6.jpg',
    },
    {
      texto: '¿Quién debe asegurarse de que esta premisa se cumpla?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'El que ejecuta el trabajo',
        'Todo el personal',
        'El Referente SSMAC',
        'El Supervisor',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'intermedio-image14.jpg',
    },
  ],
  'reglas-oro': [
    {
      texto: '¿Quién PUEDE y DEBE aplicar las Reglas de Oro?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo el Técnico de Seguridad',
        'Solo el Supervisor',
        'Mi compañero',
        'Todos',
      ],
      respuestaCorrecta: 'Todos',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Excavaciones',
        'Operaciones de Izaje',
        'Seguridad Vial',
        'Equipamiento en movimiento',
      ],
      respuestaCorrecta: 'Seguridad Vial',
      imagen: 'reglas-oro-image4.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavaciones',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Permiso de trabajo',
      imagen: 'reglas-oro-image6.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavaciones',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Trabajo en altura',
      imagen: 'reglas-oro-image12.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Línea de Fuego',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Línea de Fuego',
      imagen: 'reglas-oro-image7.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavaciones',
        'Operaciones de Izado',
      ],
      respuestaCorrecta: 'Operaciones de Izado',
      imagen: 'reglas-oro-06-compuesta.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavaciones',
        'Aislamiento de Energías',
      ],
      respuestaCorrecta: 'Aislamiento de Energías',
      imagen: 'reglas-oro-image8.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Espacio Confinado',
        'Excavaciones',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Espacio Confinado',
      imagen: 'reglas-oro-image5.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Manejo del Cambio',
        'Excavaciones',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Manejo del Cambio',
      imagen: 'reglas-oro-image9.jpg',
    },
    {
      texto: 'Indique qué Regla de Oro corresponde a Espacio Confinado',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image6.jpg',
        'reglas-oro-image5.jpg',
        'reglas-oro-image9.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image5.jpg',
    },
    {
      texto: 'Indique qué Regla de Oro corresponde a Línea de Fuego',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image5.jpg',
        'reglas-oro-image9.jpg',
        'reglas-oro-image7.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image7.jpg',
    },
    {
      texto: 'Indique qué Regla de Oro corresponde a Operaciones de Izado',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image10.jpg',
        'reglas-oro-image7.jpg',
        'reglas-oro-image4.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image10.jpg',
    },
    {
      texto: 'Indique qué Regla de Oro aplica a Aislamiento de Energías',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image5.jpg',
        'reglas-oro-image8.jpg',
        'reglas-oro-image9.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image8.jpg',
    },
    {
      texto: 'Indique qué Regla de Oro aplica a Manejo del Cambio',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image9.jpg',
        'reglas-oro-image8.jpg',
        'reglas-oro-image6.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image9.jpg',
    },
    {
      texto: 'Indique qué Regla de Oro aplica a Seguridad Vial',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image4.jpg',
        'reglas-oro-image5.jpg',
        'reglas-oro-image6.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image4.jpg',
    },
    {
      texto: 'Indique qué Regla de Oro aplica a Permiso de Trabajo',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image5.jpg',
        'reglas-oro-image6.jpg',
        'reglas-oro-image4.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image6.jpg',
    },
    {
      texto: 'Indique qué Regla de Oro aplica a Trabajo en Altura',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image3.jpg',
        'reglas-oro-image4.jpg',
        'reglas-oro-image5.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image3.jpg',
    },
    {
      texto: 'Ante una situación insegura, suspender la tarea es un derecho y una responsabilidad…',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        '…solo del Técnico de Seguridad',
        '…de todos',
        '…solo del Supervisor',
        '…de la Operadora',
      ],
      respuestaCorrecta: '…de todos',
    },
    {
      texto: 'En un ESPACIO CONFINADO debo verificar y registrar las condiciones de la atmósfera mediante equipos de medición calibrados y personal competente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar el bloqueo de la fuente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'LÍNEA DE FUEGO: es el lugar donde una persona (o parte de su cuerpo) puede ser impactada, golpeada o atravesada por objetos, materiales o cualquier tipo de energía que se libera repentinamente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'PERMISO DE TRABAJO: debe estar debidamente autorizado, con los peligros y las salvaguardas correspondientes identificados para cada paso de la tarea.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'OPERACIONES DE IZADO: el equipo y los elementos de izaje deben tener certificación vigente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'SEGURIDAD VIAL: hay que cumplir con las normas de Seguridad Vial solo dentro de los yacimientos.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'TRABAJO EN ALTURA: el operario debe contar con la aptitud psicofísica, las capacitaciones y el entrenamiento para realizar tareas en altura.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'MANEJO DEL CAMBIO: en una gestión de cambio se evalúan las nuevas condiciones con el personal afectado a la tarea, revisando los análisis de riesgo realizados según la nueva condición.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'AISLAMIENTO DE ENERGÍA: es aislar todas las fuentes de energía identificadas, bloquear y etiquetar de modo de impedir el accionamiento de forma errónea.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
  ],
  'phoenix': [
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) aplica a Trabajo en Altura.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image5.jpg',
        'phoenix-image3.jpg',
        'phoenix-image2.jpg',
      ],
      respuestaCorrecta: 'phoenix-image5.jpg',
    },
    {
      texto: 'La SEGURIDAD es un compromiso…',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        '…solo del Técnico de Seguridad',
        '…de todos',
        '…solo del Supervisor',
        '…solo de mi compañero',
      ],
      respuestaCorrecta: '…de todos',
    },
    {
      texto: '¿Quién PUEDE y DEBE aplicar las Reglas que Salvan Vidas (RSV)?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo los Referentes de SSMAC',
        'Solo los Supervisores',
        'Quien ejecuta el trabajo',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'phoenix-image18.jpg',
    },
    {
      texto: 'Indicar de qué regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Excavación',
        'Izaje',
        'Conducción de Vehículos',
        'Equipamiento en movimiento',
      ],
      respuestaCorrecta: 'Conducción de Vehículos',
      imagen: 'phoenix-image9.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavación',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Permiso de trabajo',
      imagen: 'phoenix-image7.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Excavación.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image8.jpg',
        'phoenix-image4.jpg',
        'phoenix-image3.jpg',
      ],
      respuestaCorrecta: 'phoenix-image4.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Espacios Confinados.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image6.jpg',
        'phoenix-image4.jpg',
        'phoenix-image8.jpg',
      ],
      respuestaCorrecta: 'phoenix-image8.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Trabajo en Caliente.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image1.jpg',
        'phoenix-image6.jpg',
        'phoenix-image8.jpg',
      ],
      respuestaCorrecta: 'phoenix-image1.jpg',
    },
    {
      texto: 'Las Reglas que Salvan Vidas (RSV) han sido establecidas para...',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'PREVENIR - SABER',
        'PREVENIR - INTERVENIR',
        'INTERVENIR - CONOCER',
        'Todas las anteriores son correctas',
      ],
      respuestaCorrecta: 'Todas las anteriores son correctas',
    },
    {
      texto: '¿En qué recipiente debo disponer un residuo PLÁSTICO libre de hidrocarburo?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image13.jpg',
        'phoenix-image14.jpg',
        'phoenix-image12.jpg',
      ],
      respuestaCorrecta: 'phoenix-image13.jpg',
    },
    {
      texto: '¿En qué recipiente debo disponer un residuo BIODEGRADABLE (restos de comida, papel, cartón, madera, etc.)?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image14.jpg',
        'phoenix-image17.jpg',
        'phoenix-image11.jpg',
      ],
      respuestaCorrecta: 'phoenix-image17.jpg',
    },
    {
      texto: '¿En qué recipiente debo disponer un residuo de VIDRIO libre de hidrocarburo?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image14.jpg',
        'phoenix-image16.jpg',
        'phoenix-image15.jpg',
      ],
      respuestaCorrecta: 'phoenix-image15.jpg',
    },
    {
      texto: '¿En qué recipiente debo disponer un residuo CONTAMINADO CON HIDROCARBUROS?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image14.jpg',
        'phoenix-image11.jpg',
        'phoenix-image13.jpg',
      ],
      respuestaCorrecta: 'phoenix-image11.jpg',
    },
    {
      texto: '¿En qué recipiente debo disponer los residuos METÁLICOS limpios, sin hidrocarburos (caños, electrodos, recortes de chapa, latas, etc.)?',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image14.jpg',
        'phoenix-image15.jpg',
        'phoenix-image11.jpg',
      ],
      respuestaCorrecta: 'phoenix-image14.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Aislamiento de Energía.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image9.jpg',
        'phoenix-image6.jpg',
        'phoenix-image3.jpg',
      ],
      respuestaCorrecta: 'phoenix-image6.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Izaje.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image2.jpg',
        'phoenix-image5.jpg',
        'phoenix-image3.jpg',
      ],
      respuestaCorrecta: 'phoenix-image2.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Conducción de Vehículos.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image9.jpg',
        'phoenix-image3.jpg',
        'phoenix-image7.jpg',
      ],
      respuestaCorrecta: 'phoenix-image9.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) aplica a Línea de Fuego.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image1.jpg',
        'phoenix-image3.jpg',
        'phoenix-image6.jpg',
      ],
      respuestaCorrecta: 'phoenix-image3.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Permiso de Trabajo.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image1.jpg',
        'phoenix-image7.jpg',
        'phoenix-image6.jpg',
      ],
      respuestaCorrecta: 'phoenix-image7.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Izaje',
        'Excavación',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Izaje',
      imagen: 'phoenix-image2.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Aislamiento de Energía',
        'Excavación',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Aislamiento de Energía',
      imagen: 'phoenix-image6.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Línea de Fuego',
        'Excavación',
        'Trabajo en Caliente',
      ],
      respuestaCorrecta: 'Trabajo en Caliente',
      imagen: 'phoenix-image1.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavación',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Línea de Fuego',
      imagen: 'phoenix-image3.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavación',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Trabajo en altura',
      imagen: 'phoenix-image5.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavación',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Excavación',
      imagen: 'phoenix-image4.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Espacio Confinado',
        'Excavación',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Espacio Confinado',
      imagen: 'phoenix-image8.jpg',
    },
    {
      texto: 'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Barrera de control de riesgo',
        'Línea de Fuego',
      ],
      respuestaCorrecta: 'Barrera de control de riesgo',
      imagen: 'phoenix-image10.jpg',
    },
    {
      texto: 'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Barrera de control de riesgo degradada.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image10.jpg',
        'phoenix-image8.jpg',
        'phoenix-image6.jpg',
      ],
      respuestaCorrecta: 'phoenix-image10.jpg',
    },
    {
      texto: 'Las Reglas que Salvan Vidas son requisitos mínimos que debe aplicar la totalidad del personal que trabaja diariamente en las operaciones de Phoenix Global Resources (PGR), para facilitar la prevención de riesgos con consecuencias fatales o graves.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar el bloqueo de la fuente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Un ESPACIO CONFINADO es cualquier espacio con aberturas limitadas de entrada y salida, y/o cuya ventilación natural sea o pueda ser desfavorable, y que pueda contener productos peligrosos.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Un TRABAJO EN CALIENTE es un trabajo que puede producir una fuente de ignición de los materiales inflamables o combustibles presentes en el entorno.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Una barrera de control de riesgos degradada es aquella que, por mal funcionamiento y/o deterioro, no cumple la función para la cual fue diseñada, aumentando el riesgo de ocurrencia de un incidente mayor.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'El AISLAMIENTO DE ENERGÍA es un sistema mediante el cual un equipo, instalación o proceso es aislado de modo efectivo de la fuente de energía que lo acciona.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Quién tiene la responsabilidad de identificar claramente las medidas de control para prevenir y mitigar los riesgos?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo los Referentes de SSMAC',
        'Solo los Supervisores',
        'Quien ejecuta el trabajo',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
    },
    {
      texto: 'IZAJE: operación que permite el levantamiento y la suspensión de cargas de manera segura y controlada, mediante equipos aptos y habilitados para ese fin.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La CONDUCCIÓN VEHICULAR es la acción del conductor para hacer funcionar el vehículo de manera controlada, teniendo en cuenta sus capacidades y cumpliendo las reglas que apliquen.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La LÍNEA DE FUEGO es un área de proyección y contacto con partes de instalaciones, equipos, cargas, vehículos y máquinas.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'El TRABAJO EN ALTURA es toda tarea que involucre circular o trabajar a un nivel cuya diferencia de cota sea igual o mayor a 2 metros.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Una EXCAVACIÓN es una cavidad o depresión en el terreno hecha por el hombre, ya sea en forma manual o mecánica.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Quién PUEDE y DEBE aplicar la Autoridad para Detener una Tarea y revisar la actividad cuando se vulnere una o más Reglas que Salvan Vidas (RSV)?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo los Referentes de SSMAC',
        'Solo los Supervisores',
        'Quien ejecuta el trabajo',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
    },
    {
      texto: 'No es necesario obtener una autorización antes de deshabilitar o anular un dispositivo de seguridad.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Permanecer debajo de una carga suspendida no se considera estar en la línea de fuego.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Una barrera de control degradada es aquella que perdió su capacidad de cumplir la función para la que fue diseñada.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En trabajos en altura es obligatorio usar un sistema de control de caídas y estar siempre conectado a un punto de anclaje apto.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: '¿Qué debe hacer un trabajador antes de ingresar a un espacio confinado?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Usar casco solamente',
        'No necesita autorización previa',
        'Ingresar rápidamente para no perder tiempo',
        'Confirmar condiciones de ventilación y plan de rescate',
      ],
      respuestaCorrecta: 'Confirmar condiciones de ventilación y plan de rescate',
    },
    {
      texto: 'En un espacio confinado siempre debe haber un vigía presente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'El permiso de trabajo asegura que existen condiciones seguras para realizar una tarea.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Ante cambios en las condiciones de trabajo se debe detener la actividad y reevaluar.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Las Reglas que Salvan Vidas aplican únicamente al personal nuevo en la empresa.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'No es necesario discutir ni difundir el ATS en el frente de trabajo antes de comenzar las tareas.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: '¿Quién es el responsable de discutir el ATS con el personal que va a realizar la tarea y de asegurarse de que se apliquen los controles necesarios antes y durante su desarrollo?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Ref. SSMAC',
        'Jefe de Obra',
        'No requiere discusión',
        'Supervisor',
      ],
      respuestaCorrecta: 'Supervisor',
    },
    {
      texto: 'Antes de comenzar una tarea, el ATS debe ser revisado por el Supervisor y el personal involucrado, y llevar la firma de todos ellos.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
  ],
};
