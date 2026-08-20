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
      texto: '¿Quienes deben aplicar las Reglas de Oro de Ingeniería Sima?',
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
      texto: 'Indique de que regla se trata.',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Prohibido utilizar grúas',
        'Permiso de izaje',
        'Prohibidos circular debajo de carga suspendida',
        'Equipo de izaje en movimiento',
      ],
      respuestaCorrecta: 'Prohibidos circular debajo de carga suspendida',
      imagen: 'basico-image28.jpg',
    },
    {
      texto: 'La Política de detención de tareas, quien la puede aplicar?',
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
      texto: 'Indicar de que regla se trata:',
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
      texto: 'Indicar de que regla se trata:',
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
      texto: 'Indicar de que regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavaciones',
        'Aislaciones de Energía',
      ],
      respuestaCorrecta: 'Aislaciones de Energía',
      imagen: 'basico-image24.jpg',
    },
    {
      texto: 'Indicar de que regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Prohibido beber y comer',
        'Prohibido tomar agua',
        'Agua no potable',
        'Prohibido el consumo Alcohol y Drogas',
      ],
      respuestaCorrecta: 'Prohibido el consumo Alcohol y Drogas',
      imagen: 'basico-image27.jpg',
    },
    {
      texto: 'Indicar de que regla se trata:',
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
      texto: 'Indicar de que regla se trata:',
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
      texto: 'Indique que Regla corresponde a Excavación y Apertura',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image25.jpg',
        'basico-image1.jpg',
        'basico-image28.jpg',
      ],
      respuestaCorrecta: 'basico-image1.jpg',
    },
    {
      texto: 'Indique que Regla corresponde carga suspendida',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image40.jpg',
        'basico-image25.jpg',
        'basico-image28.jpg',
      ],
      respuestaCorrecta: 'basico-image28.jpg',
    },
    {
      texto: 'Indique que Regla aplica para trabajo con equipos de izaje',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image25.jpg',
        'basico-image40.jpg',
        'basico-image21.jpg',
      ],
      respuestaCorrecta: 'basico-image25.jpg',
    },
    {
      texto: 'Indique que Regla corresponde aplica a Aislamiento de Energías',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image16.jpg',
        'basico-image24.jpg',
        'basico-image21.jpg',
      ],
      respuestaCorrecta: 'basico-image24.jpg',
    },
    {
      texto: 'Indique que Regla corresponde a Detención de Tarea',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image22.jpg',
        'basico-image28.jpg',
        'basico-image27.jpg',
      ],
      respuestaCorrecta: 'basico-image22.jpg',
    },
    {
      texto: 'Indique que Regla corresponde a Trabajo en Altura',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image16.jpg',
        'basico-image39.jpg',
        'basico-image25.jpg',
      ],
      respuestaCorrecta: 'basico-image39.jpg',
    },
    {
      texto: 'Indique que Regla corresponde a Línea de Fuego',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image16.jpg',
        'basico-image25.jpg',
        'basico-image40.jpg',
      ],
      respuestaCorrecta: 'basico-image40.jpg',
    },
    {
      texto: 'Indique que Regla corresponde a Seguridad Vial',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image21.jpg',
        'basico-image25.jpg',
        'basico-image40.jpg',
      ],
      respuestaCorrecta: 'basico-image21.jpg',
    },
    {
      texto: 'Indique que Regla corresponde a Permiso de Trabajo',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image21.jpg',
        'basico-image25.jpg',
        'basico-image16.jpg',
      ],
      respuestaCorrecta: 'basico-image16.jpg',
    },
    {
      texto: 'Indique que Regla corresponde a Prohibición de consumo de Alcohol y Drogas',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image28.jpg',
        'basico-image27.jpg',
        'basico-image22.jpg',
      ],
      respuestaCorrecta: 'basico-image27.jpg',
    },
    {
      texto: 'LÍNEA DE FUEGO: Lugar donde una persona (o parte de su cuerpo) puede ser impactada, golpeada o atravesada por objetos, materiales o cualquier tipo de energía que se libera repentinamente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'PERMISO DE TRABAJO: Documento formal que autoriza la realización de una tarea específica, establece puntos de chequeo para verificar las condiciones y medidas de seguridad que deben seguirse para prevenir accidentes.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'OPERACIONES DE ELEVACION Y MONTAJE: El equipo, los elementos, el operador y el señaleros en una tarea de izaje deben tener certificación vigentes',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La Política de DETENCION DE TAREA la aplica solo los Ref. SSAMC.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'El orden y la limpieza son factores claves para prevenir accidentes',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Debo utilizar detector de gases con calibración vigente al momento de ingresar a una zona con presencia de gases.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Nunca debemos en una maniobra de izaje circular por debajo de la carga suspendida',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La política de la prohibición del consumo de alcohol y drogas solo se aplica a la conducción de vehículos y equipos.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Ajustar la velocidades a las condiciones climáticas, estado del camino, condición de iluminación es una forma de aplicar Seguridad Vial',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Siempre que suba o baje escaleras debo aplicar la técnica de los tres puntos de apoyo',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Se permite fumar y/o usar cigarrillos electrónicos dentro de los tráiler u oficinas.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'En caso de eventualidades (derrames, accidentes personal, incendio, accidente de transito) debo activar el Rol de Emergencias de Ingeniería Sima que aplica a cada sitio.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En que tacho debo disponer un residuo METALICO libre de hidrocarburo',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image19.jpg',
    },
    {
      texto: 'En que tacho debo disponer un residuo BIODEGRADABLES o RECICLABLES libre de hidrocarburo',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image9.jpg',
    },
    {
      texto: 'En que tacho debo disponer los residuos CONDICIONADOS o SUELOS CONTAMINADOS',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image11.jpg',
    },
    {
      texto: 'En que tacho debo disponer los residuos contaminados con hidrocarburos y productos químicos, como filtros, trapos, guantes, suelo, aceites.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image11.jpg',
    },
    {
      texto: 'En que tacho debo disponer la yerba, resto de comida, cartones, envases plásticos libres de hidrocarburos o químicos',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image9.jpg',
    },
    {
      texto: 'En que tacho debo disponer los restos de chapas, cobre, broce, chatarra, libres de hidrocarburos',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image19.jpg',
        'basico-image9.jpg',
        'basico-image11.jpg',
      ],
      respuestaCorrecta: 'basico-image19.jpg',
    },
    {
      texto: 'Indique que significa este pictograma.',
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
      texto: 'Debo conocer el Rol de emergencias y punto de reunión de cada sitio de trabajo.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Ingeniería Sima prohíbe el uso de vehículos de la empresa para uso personal.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Indique si esta imagen corresponde a la reglas de las 3R',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
      imagen: 'basico-image31.png',
    },
    {
      texto: 'Indique cual es la posición correcta para el levantamiento manual de cargas',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image34.png',
        'basico-image29.png',
      ],
      respuestaCorrecta: 'basico-image29.png',
    },
    {
      texto: 'Indique en cual de las imágenes ve riesgo eléctrico o posibilidad de incendio',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image26.jpg',
        'basico-image35.jpg',
      ],
      respuestaCorrecta: 'basico-image26.jpg',
    },
    {
      texto: 'Indique cual es una postura ergonómicamente correcta',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image30.jpg',
        'basico-image36.jpg',
      ],
      respuestaCorrecta: 'basico-image30.jpg',
    },
    {
      texto: 'Indique cual de estos no se considera un residuo peligroso',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image20.jpg',
        'basico-image15.jpg',
        'basico-image12.jpg',
      ],
      respuestaCorrecta: 'basico-image12.jpg',
    },
    {
      texto: 'Indicar de que se trata la siguiente imagen:',
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
      texto: 'Indicar de que se trata la siguiente imagen:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Obligatorio uso de guantes de protección',
        'Prohibido aplaudir',
        'Obligación saludar',
        'Salude al ingresar',
      ],
      respuestaCorrecta: 'Obligatorio uso de guantes de protección',
      imagen: 'basico-image32.jpg',
    },
    {
      texto: 'El término ralentí hace referencia al régimen mínimo de revoluciones a las cuales se puede mantener estable el funcionamiento de un motor de combustión interna sin requerir aceleración. Se produce cuando el vehículo esta detenido con el motor en marcha',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'El ralentí no genera ningún inconveniente al ambiente',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Indicar de que se trata la siguiente imagen:',
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
      texto: 'Cual no es una energía renovable',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'basico-image13.jpg',
        'basico-image18.jpg',
        'basico-image14.jpg',
      ],
      respuestaCorrecta: 'basico-image14.jpg',
    },
    {
      texto: 'Que es un EPP',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Elemento de producción personal',
        'Equipo de prevención personal',
        'Equipo de producción personal',
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
      texto: '¿Cual es la primera acción que debe realizar el observador ante un Cuasi - accidente?.',
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
      texto: 'Los vehículos de la empresa cuentan con un sistema de arranque de identificación obligatoria, por lo cual a cada conductor se le asigna una llave de uso estrictamente personal e intransferible denominada llave PIN',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Se prohíbe el uso de vehículos de la empresa fuera de los horarios laborales y para uso personal',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Según el procedimiento de Mantenimiento de vehículos y equipos, es obligatorio realizar el check list forma mensual ?',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Toda contravención de transito deberá ser asumida por la persona que conduzca la unidad en ese momento y lugar.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Es necesario que todo personal nuevo, en un Sector, Obras o Servicios reciba una inducción en sitio de trabajo antes de comenzar las actividades.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Al trasportar manualmente una carga es importante siempre poder visualizar el camino a recorrer',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Para la ley de transito, las bicicletas son consideradas otro vehículo más.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
  ],
  'intermedio': [
    {
      texto: 'Indique que símbolo nos indica la eficiencia energética de un electrodoméstico',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'intermedio-image2.jpg',
        'intermedio-image3.jpg',
        'intermedio-image4.jpg',
      ],
      respuestaCorrecta: 'intermedio-image4.jpg',
    },
    {
      texto: 'Indique que significa estas imágenes',
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
      texto: 'Quienes deben aplicar las Reglas de Oro de Ingeniería Sima?',
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
      texto: 'La Política de detención de tareas, quien la puede aplicar?',
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
      texto: 'Las Reglas de Oro para trabajo en equipos y sistemas eléctricos sin tensión son:\n1. Corte Visible\n2. Enclavamiento y bloqueo\n3. Verificación de ausencia de tensión\n5. Puesta a tierra y cortocircuito\n6. Señalización de la zona',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Indique que significa esta imagen',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Conducción segura',
        'Medición de puesta a tierra',
        'La Regla de los 5 puntos de apoyo',
        'Las 5 reglas de oro para trabajo sin tensión',
      ],
      respuestaCorrecta: 'Las 5 reglas de oro para trabajo sin tensión',
      imagen: 'intermedio-image9.jpg',
    },
    {
      texto: 'Indique que significa esta imagen',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Cadena de supervivencia',
        'Denuncia a la ART',
      ],
      respuestaCorrecta: 'Cadena de supervivencia',
      imagen: 'intermedio-image10.jpg',
    },
    {
      texto: 'Indique que significa esta imagen',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'RCP',
        'GPS',
      ],
      respuestaCorrecta: 'RCP',
      imagen: 'intermedio-image11.jpg',
    },
    {
      texto: 'Es necesario que todo personal nuevo en el Sector, Obras, Servicios reciba una inducción en sitio de trabajo antes de comenzar las actividades.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En un ESPACIO CONFINADO debo verificar y registrar las condiciones de la atmosfera mediante equipos de medición calibrados y personal competente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Indique que significa esta imagen',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Puntos ciegos en equipos pesados',
        'Iluminación auxiliar de los equipos',
      ],
      respuestaCorrecta: 'Puntos ciegos en equipos pesados',
      imagen: 'intermedio-image12.jpg',
    },
    {
      texto: 'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar presiones residuales.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'PROHIBIDO retirar o remover dispositivos de bloqueo y/o etiquetas en los equipos que no fueron colocados por mí.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Indique que es el Ralentí',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Hacer aceleradas cortas mientras espero la habilitación del semáforo',
        'Dejar el vehículo detenido con el motor en marcha',
        'No cumplir con los mantenimiento programados',
        'Parar y arrancar el vehículo en cada detención',
      ],
      respuestaCorrecta: 'Dejar el vehículo detenido con el motor en marcha',
      imagen: 'intermedio-image13.png',
    },
    {
      texto: 'El ralentí genera impacto en el ambiente y desgaste en el motor',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Todo producto químico debe estar etiquetado según SGA',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Estos Pictogramas corresponden a los productos químicos según el SGA - Sistema Globalmente Armonizado',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
      imagen: 'intermedio-image5.jpg',
    },
    {
      texto: 'Una contravención de transito es una conducta antijurídica que se encuentra penada por la Ley Nacional de Tránsito, la misma debe ser asumida por la persona que conduzca la unidad en ese momento y lugar.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Cual es el propósito de realizar simulacros en sitios de trabajo',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Para entretener',
        'Para conocer como activar el rol de emergencias',
        'Para gastar tiempo',
        'Para ser bombero',
      ],
      respuestaCorrecta: 'Para conocer como activar el rol de emergencias',
    },
    {
      texto: 'Cuando un vehículo viene de frente por el mismo carril, debemos aplicar la regla de las cuatro "M"\n1- Mirar la Ruta\n2- Mantener la derecha\n3- Mermar la Velocidad\n4- Maniobrar hacia afuera de la ruta',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Estas son las cuatro prohibiciones cuando utilizamos un vehículo de la empresa.\n1- Ceder la conducción a personal ajeno a la empresa\n2- Transportar a personas ajenas a la Empresa\n3- Ceder la llave PIN o de ID de arranque\n4- Uso personal del vehículo',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Quienes deben confeccionar una tarjeta de observación si se advierte de un desvío?',
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
      texto: 'Confeccionar tarjetas de observaciones, participar en la confección de un IPER, proponer una oportunidad de mejora es una forma de Participación y Consulta de los Trabajadores.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Quien debe asegurarse que esta premisa se cumpla?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'el que ejecuta el trabajo',
        'todo el personal',
        'el Referente SSMAC',
        'del Supervisor',
      ],
      respuestaCorrecta: 'todo el personal',
      imagen: 'intermedio-image14.jpg',
    },
    {
      texto: 'De que se trata esta Pirámide?',
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
      texto: 'Quien debe identificar condiciones y acciones inseguras?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'el que ejecuta el trabajo',
        'del Supervisor',
        'el Referente SSMAC',
        'todo el personal',
      ],
      respuestaCorrecta: 'todo el personal',
      imagen: 'intermedio-image15.jpg',
    },
  ],
  'avanzado': [
    {
      texto: 'Quienes deben aplicar las Reglas de Oro de Ingeniería Sima?',
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
      texto: 'La Política de detención de tareas, quien la puede aplicar?',
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
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión " Cumplir con los requisitos y expectativas de sus cliente y demás partes interesadas"',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión " Concientizar a todos los integrantes de la organización para dar cumplimiento a esta Política"',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión "Aplicar los requisitos legales, practica de trabajo seguro y protección ambiental solo cuando el cliente los solicite"',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión "Promover la eliminación de peligros y reducción de riesgos en la gestión de Seguridad y Salud en el Trabajo"',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Es un punto de la Política del Sistema Integrado de Gestión "Cumplir con los requisitos legales y otros requisitos aplicables solo cuando sea posible"',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Según la Política de Ingeniería Sima "Las practicas seguras de trabajo es responsabilidad …"',
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
      texto: 'Nuestra Visión: "Ser la opción más confiable en la producción de hidrocarburos y en la generación de otras formas de energías"',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Nuestra Visión: "Ser la empresa mejor vista y optimista del mercado"',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Nuestra Misión: “Ofrecer ventajas competitivas a nuestros clientes: calidad, bajos costos, y rapidez, basadas en los criterios máximos de la industria en cuanto salud, seguridad, medio ambiente y responsabilidad social”',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Este es el alcance que Ingeniería Sima tiene certificado: “Ingeniería, ejecución, montaje y puesta en marcha de proyectos constructivos, tipo “llave en mano”. Servicio de movimiento de suelos. Servicio de operación y mantenimiento de yacimientos de petróleo y gas. “',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'La ISO 14001 es una norma internacional que proporciona orientación respecto a como gestionar los aspectos medioambientales de una organización.',
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
      texto: 'La norma ISO 14001 es una norma internacional que establece los requisitos para un Sistema de Gestión de Salud y Seguridad Ocupacional (SST)',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'PELIGRO: Es un agente (material o energía) con potencial para provocar daños en las personas, instalaciones, equipos, materiales y al medio ambiente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'RIESGO: Es la combinación de la probabilidad de ocurrencia y de la consecuencia de un determinado evento peligroso.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Para que utiliza esta herramienta ?',
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
      texto: 'Que significa el termino Ergonomía',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Elemento de producción personal',
        'Equipo de prevención personal',
        'Capacitar al personal en uso adecuado de EPP',
        'Diseñar espacios de trabajo para minimizar la fatiga y el estrés físico',
      ],
      respuestaCorrecta: 'Diseñar espacios de trabajo para minimizar la fatiga y el estrés físico',
    },
    {
      texto: 'Cuando se realicen trabajos fuera de los horarios habituales, fines de semana o feriado el supervisor o jefe de obra debe enviar un comunicación al mail a trabajonorutinario@sima.com.ar indicando la actividad que se va a realizar y personal afectado, este mail informa a Dirección, Gerencias, SSMAC, RRHH',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Si se va a realizar un trabajo fuera de los horarios habituales o fines de semana no es necesario dar aviso, solo se debe pasar las horas a RRHH.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Es un objetivo disminuir la recepción de mail al comomanejo@sima.com.ar, por parte de la comunidad por causas y conductas impropias de nuestros conductores.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Como puedo mejorar mi conducta proactiva',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Cumpliendo solo con lo que me solicita el cliente',
        'Confeccionando Tarjetas de Observaciones, Auditorias de campo, Visitas Gerenciales',
      ],
      respuestaCorrecta: 'Confeccionando Tarjetas de Observaciones, Auditorias de campo, Visitas Gerenciales',
    },
    {
      texto: 'Es responsabilidad de los Jefes de Obras, Jefes de Servicios y Referentes de SSMAC destinar un espacio de tiempo para realizar una inducción en sitio de trabajo antes de que el nuevo empleado comience las actividades, dejando registro de la misma.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En actividad EXCAVACIONES o ZANJEO en zonas de baterías o plantas, no es necesario realizar la geo detección de interferencias.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Una contravención de transito es una conducta antijurídica que se encuentra penada por la Ley Nacional de Tránsito, la misma debe ser asumida por la persona que conduzca la unidad en ese momento y lugar.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En el procedimiento de Gestión de la Organización define las herramientas que dispone la empresa para la Participación y Consulta de los Trabajadores ( confección y revisión de los IPER, tarjetas de observaciones, participación en la confección de procedimientos e instructivos, Sima Check, etc.)',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Estas son las cuatro prohibiciones cuando utilizamos un vehículo de la empresa.\n1- Ceder la conducción a personal ajeno a la empresa\n2- Transportar a personas ajenas a la Empresa\n3- Ceder la llave PIN o de ID de arranque\n4- Uso personal del vehículo',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'De que se trata esta Pirámide?',
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
      texto: 'Que hace Ingeniería Sima en la industria?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Hace Obras de ductos, movimiento de suelo, construcción de plantas',
        'Gestiona Proyectos',
        'Presta Servicios de O&M para la industria petrolera',
        'Ejecutar Obras y ofrecer Servicios enfocados en satisfacer las necesidades de nuestros clientes',
      ],
      respuestaCorrecta: 'Ejecutar Obras y ofrecer Servicios enfocados en satisfacer las necesidades de nuestros clientes',
      imagen: 'avanzado-image6.jpg',
    },
    {
      texto: 'Quien debe asegurarse que esta premisa se cumpla?',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'el que ejecuta el trabajo',
        'todo el personal',
        'el Referente SSMAC',
        'del Supervisor',
      ],
      respuestaCorrecta: 'todo el personal',
      imagen: 'intermedio-image14.jpg',
    },
  ],
  'reglas-oro': [
    {
      texto: 'Quien PUEDE y DEBE aplicar las Regla de Oro',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        '...Solo del Técnico de Seguridad',
        '…Solo del Supervisor',
        '…mi compañero',
        '... todos',
      ],
      respuestaCorrecta: '... todos',
    },
    {
      texto: 'Indicar de que regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Excavaciones',
        'Operaciones de Izaje',
        'Seguridad vial',
        'Equipamiento en movimiento',
      ],
      respuestaCorrecta: 'Seguridad vial',
      imagen: 'reglas-oro-image4.jpg',
    },
    {
      texto: 'Indicar de que regla se trata:',
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
      texto: 'Indicar de que regla se trata:',
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
      texto: 'Indicar de que regla se trata:',
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
      texto: 'Indicar de que regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavaciones',
        'Operaciones de izado',
      ],
      respuestaCorrecta: 'Operaciones de izado',
      imagen: 'reglas-oro-06-compuesta.jpg',
    },
    {
      texto: 'Indicar de que regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavaciones',
        'Aislamiento de energías',
      ],
      respuestaCorrecta: 'Aislamiento de energías',
      imagen: 'reglas-oro-image8.jpg',
    },
    {
      texto: 'Indicar de que regla se trata:',
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
      texto: 'Indicar de que regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Manejo de Cambio',
        'Excavaciones',
        'Equipo en movimiento',
      ],
      respuestaCorrecta: 'Manejo de Cambio',
      imagen: 'reglas-oro-image9.jpg',
    },
    {
      texto: 'Indique que Regla de Oro corresponde a Espacio Confinado',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image6.jpg',
        'reglas-oro-image5.jpg',
        'reglas-oro-image9.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image5.jpg',
    },
    {
      texto: 'Indique que Regla de Oro corresponde a Línea de fuego',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image5.jpg',
        'reglas-oro-image9.jpg',
        'reglas-oro-image7.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image7.jpg',
    },
    {
      texto: 'Indique que Regla de Oro corresponde a Operaciones de Izado',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image10.jpg',
        'reglas-oro-image7.jpg',
        'reglas-oro-image4.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image10.jpg',
    },
    {
      texto: 'Indique que Regla de Oro aplica a Aislamiento de Energías',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image5.jpg',
        'reglas-oro-image8.jpg',
        'reglas-oro-image9.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image8.jpg',
    },
    {
      texto: 'Indique que Regla de Oro aplica a Manejo del Cambio',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image9.jpg',
        'reglas-oro-image8.jpg',
        'reglas-oro-image6.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image9.jpg',
    },
    {
      texto: 'Indique que Regla de Oro aplica a la Seguridad Vial…',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image4.jpg',
        'reglas-oro-image5.jpg',
        'reglas-oro-image6.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image4.jpg',
    },
    {
      texto: 'Indique que Regla de Oro aplica Permiso de Trabajo',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image5.jpg',
        'reglas-oro-image6.jpg',
        'reglas-oro-image4.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image6.jpg',
    },
    {
      texto: 'Indique que Regla de Oro aplica a Trabajos en Altura',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'reglas-oro-image3.jpg',
        'reglas-oro-image4.jpg',
        'reglas-oro-image5.jpg',
      ],
      respuestaCorrecta: 'reglas-oro-image3.jpg',
    },
    {
      texto: 'Ante una situación insegura, Suspender la Tarea. Es un derecho y una responsabilidad …',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        '...Solo del Técnico de Seguridad',
        '…de Todos',
        '…Solo del Supervisor',
        '… de la Operadora',
      ],
      respuestaCorrecta: '…de Todos',
    },
    {
      texto: 'En un ESPACIO CONFINADO debo verificar y registrar las condiciones de la atmosfera mediante equipos de medición calibrados y personal competente',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar el bloqueo de la fuente',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'LÍNEA DE FUEGO: Lugar donde una persona (o parte de su cuerpo) puede ser impactada, golpeada o atravesada por objetos, materiales o cualquier tipo de energía que se libera repentinamente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'PERMISO DE TRABAJO: Debe estar debidamente autorizado, identificado los peligros y salvaguardas correspondientes a cada paso de la tarea.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'OPERACIONES DE IZADO: El equipo y los elementos de izaje deben tener certificación vigentes',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'SEGURIDAD VIAL: Cumplir con las normas de Seguridad Vial solo dentro de los yacimientos',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'TRABAJO EN ALTURA: El operario debe contar con la aptitud psicofísica, capacitaciones y entrenamiento para realizar tareas en altura.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'MANEJO DEL CAMBIO: En una gestión de cambio se evalúa con el personal afectado a la tarea las nuevas condiciones, revisando los análisis de riegos realizados según la nueva condición',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'AISLAMIENTO DE ENERGÍA: Es aislar todas las fuentes de energía identificadas, bloquear y etiquetar de modo de impedir el accionamiento de forma erronea.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
  ],
  'phoenix': [
    {
      texto: 'Indique que Reglas que Salvan Vidas (RSV) aplica a Trabajos en Altura …',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image5.jpg',
        'phoenix-image3.jpg',
        'phoenix-image2.jpg',
      ],
      respuestaCorrecta: 'phoenix-image5.jpg',
    },
    {
      texto: 'La SEGURIDAD es un compromiso …',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        '...Solo del Técnico de Seguridad',
        '…de todos',
        '…Solo del Supervisor',
        '…solo de mi compañero',
      ],
      respuestaCorrecta: '…de todos',
    },
    {
      texto: 'Quien PUEDE y DEBE aplicar las Reglas que Salvan Vidas (RSV)',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo los Referentes de SSMAC',
        'Solo los Supervisor',
        'Quien ejecuta el trabajo',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
      imagen: 'phoenix-image18.jpg',
    },
    {
      texto: 'Indicar de que regla se trata:',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Excavación',
        'Izaje',
        'Conducción de vehículos',
        'Equipamiento en movimiento',
      ],
      respuestaCorrecta: 'Conducción de vehículos',
      imagen: 'phoenix-image9.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavación',
        'Línea de fuego',
      ],
      respuestaCorrecta: 'Permiso de trabajo',
      imagen: 'phoenix-image7.jpg',
    },
    {
      texto: 'Indique que Reglas que Salvan Vidas (RSV) corresponde a Excavación',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image8.jpg',
        'phoenix-image4.jpg',
        'phoenix-image3.jpg',
      ],
      respuestaCorrecta: 'phoenix-image4.jpg',
    },
    {
      texto: 'Indique que Reglas que Salvan Vidas (RSV) corresponde a Espacios Confiados',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image6.jpg',
        'phoenix-image4.jpg',
        'phoenix-image8.jpg',
      ],
      respuestaCorrecta: 'phoenix-image8.jpg',
    },
    {
      texto: 'Indique que Reglas que Salvan Vidas (RSV) corresponde a Trabajo en Caliente',
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
      texto: 'En que recipiente debo disponer un residuo PLASTICO libre de hidrocarburo9.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image13.jpg',
        'phoenix-image14.jpg',
        'phoenix-image12.jpg',
      ],
      respuestaCorrecta: 'phoenix-image13.jpg',
    },
    {
      texto: 'En que recipiente debo disponer un residuo BIODEGRADABLE (restos de comida, papel, cartón, maderas, etc.)',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image14.jpg',
        'phoenix-image17.jpg',
        'phoenix-image11.jpg',
      ],
      respuestaCorrecta: 'phoenix-image17.jpg',
    },
    {
      texto: 'En que recipiente debo disponer un residuo de VIDRIO libre de hidrocarburo.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image14.jpg',
        'phoenix-image16.jpg',
        'phoenix-image15.jpg',
      ],
      respuestaCorrecta: 'phoenix-image15.jpg',
    },
    {
      texto: 'En que tacho debo disponer un residuo CONTAMINADOS CON HIDROCARBUROS',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image14.jpg',
        'phoenix-image11.jpg',
        'phoenix-image13.jpg',
      ],
      respuestaCorrecta: 'phoenix-image11.jpg',
    },
    {
      texto: 'En que recipiente debo disponer un residuos METALICOS limpios sin hidrocarburos (caños, electrodos, recortes de chapa, latas, etc.)',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image14.jpg',
        'phoenix-image15.jpg',
        'phoenix-image11.jpg',
      ],
      respuestaCorrecta: 'phoenix-image14.jpg',
    },
    {
      texto: 'Indique que Regla que Salvan Vidas (RSV) corresponde a Aislamiento de energía.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image9.jpg',
        'phoenix-image6.jpg',
        'phoenix-image3.jpg',
      ],
      respuestaCorrecta: 'phoenix-image6.jpg',
    },
    {
      texto: 'Indique que Regla que Salvan Vidas (RSV) corresponde a Izaje.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image2.jpg',
        'phoenix-image5.jpg',
        'phoenix-image3.jpg',
      ],
      respuestaCorrecta: 'phoenix-image2.jpg',
    },
    {
      texto: 'Indique que Regla que Salvan Vidas (RSV) corresponde a Conducción de Vehículos.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image9.jpg',
        'phoenix-image3.jpg',
        'phoenix-image7.jpg',
      ],
      respuestaCorrecta: 'phoenix-image9.jpg',
    },
    {
      texto: 'Indique que Regla que Salvan Vidas (RSV) aplica a Línea de fuego.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image1.jpg',
        'phoenix-image3.jpg',
        'phoenix-image6.jpg',
      ],
      respuestaCorrecta: 'phoenix-image3.jpg',
    },
    {
      texto: 'Indique que Regla que Salvan Vidas (RSV) corresponde a Permiso de Trabajo',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image1.jpg',
        'phoenix-image7.jpg',
        'phoenix-image6.jpg',
      ],
      respuestaCorrecta: 'phoenix-image7.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Izaje',
        'Excavación',
        'Línea de fuego',
      ],
      respuestaCorrecta: 'Izaje',
      imagen: 'phoenix-image2.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Aislamiento de energía',
        'Excavación',
        'Línea de fuego',
      ],
      respuestaCorrecta: 'Aislamiento de energía',
      imagen: 'phoenix-image6.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Línea de fuego',
        'Excavación',
        'Trabajo en caliente',
      ],
      respuestaCorrecta: 'Trabajo en caliente',
      imagen: 'phoenix-image1.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavación',
        'Línea de fuego',
      ],
      respuestaCorrecta: 'Línea de fuego',
      imagen: 'phoenix-image3.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavación',
        'Línea de fuego',
      ],
      respuestaCorrecta: 'Trabajo en altura',
      imagen: 'phoenix-image5.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Excavación',
        'Línea de fuego',
      ],
      respuestaCorrecta: 'Excavación',
      imagen: 'phoenix-image4.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Espacio confinado',
        'Excavación',
        'Línea de fuego',
      ],
      respuestaCorrecta: 'Espacio confinado',
      imagen: 'phoenix-image8.jpg',
    },
    {
      texto: 'Indique a que Reglas que Salvan Vidas (RSV) corresponde',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Trabajo en altura',
        'Permiso de trabajo',
        'Barrera de control de riego',
        'Línea de fuego',
      ],
      respuestaCorrecta: 'Barrera de control de riego',
      imagen: 'phoenix-image10.jpg',
    },
    {
      texto: 'Indique que Regla que Salvan Vidas (RSV) corresponde a Barrera de control de riesgo degradada.',
      tipo: TipoPregunta.OPCIONES_IMAGEN,
      opciones: [
        'phoenix-image10.jpg',
        'phoenix-image8.jpg',
        'phoenix-image6.jpg',
      ],
      respuestaCorrecta: 'phoenix-image10.jpg',
    },
    {
      texto: 'Las reglas que salvan vidas son requisitos mínimos necesarios a aplicar por la totalidad del personal que trabaja diariamente en las operaciones de Phoenix Global Resources (PGR), para facilitar la prevención de riesgos con consecuencias fatales o graves.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En el proceso de AISLAMIENTO DE ENERGIAS puedo intervenir el equipo sin comprobar el bloqueo de la fuente.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Un ESPACIO CONFINADO es cualquier espacio con aberturas limitadas de entrada y salida y/o cuya ventilación natural sea o pueda ser desfavorable y que pueda contener productos peligrosos',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Un trabajo en Caliente es un trabajos que pueden producir una fuente de ignición de materiales inflamables o combustibles presentes en el entorno.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Una Barrera de control de riesgos degradada, es aquella que por mal funcionamiento y/o deterioro no cumple la función para la cual fue diseñada, aumentando el riesgo de ocurrencia de un incidente mayor.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Aislamiento de energía, es un sistema mediante el cual un equipo, instalación o proceso es aislado de modo efectivo de la fuente de energía que lo acciona.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Quien tiene la responsabilidad de identificar claramente las medidas de control para prevenir y mitigar los riesgos.',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo los Referentes de SSMAC',
        'Solo los Supervisor',
        'Quien ejecuta el trabajo',
        'Todo el personal',
      ],
      respuestaCorrecta: 'Todo el personal',
    },
    {
      texto: 'Izaje: Operación que permite el levantamiento y suspensión de cargas de manera segura y controlada, mediante equipos aptos y habilitados para ese fin.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Conducción vehicular, es la acción del conductor para hacerlo funcionar de manera controlada, teniendo en cuenta la capacidades del vehículo y cumplimento las reglas que apliquen',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Línea de Fuego, es un área de proyección y contacto con partes de instalaciones, equipos, cargas, vehículos y maquinas',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Trabajo en Altura, es toda tarea que involucre circular o trabajar a un nivel cuya diferencia de cota sea igual o mayor a 2 metros.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Excavación, es una cavidad o depresión en el terreno hecha por el hombre, ya sea en forma manual o mecánicas.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Quien PUEDE y DEBE aplicar la Autoridad para Detener una Tarea y revisar la actividad cunado se vulnere una o más Reglas que Salvan Vidas (RSV)',
      tipo: TipoPregunta.OPCION_MULTIPLE,
      opciones: [
        'Solo los Referentes de SSMAC',
        'Solo los Supervisor',
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
      texto: 'Permanecer debajo de una carga suspendida no es considerado estar en la línea de fuego',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'Una barrera de control degradada es aquella que perdió su capacidad de cumplir la función para la que fue diseñada.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'En trabajos en altura es obligatorio usar sistema de control de caídas y estar siempre conectado a un punto de anclaje apto.',
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
      texto: 'Ante cambios en las condiciones de trabajo, se debe detener la actividad y reevaluar',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
    {
      texto: 'Las Reglas que Salvan Vidas aplican únicamente al personal nuevo en la empresa.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: 'El ATS no es necesario discutirlo o difundirlo en el frente de trabajo antes de comenzar las tareas.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Falso',
    },
    {
      texto: '¿Quien es el responsable de discutir el ATS con el personal que va a realizar la tarea y asegurarse de que se apliquen los controles necesarios antes y durante el desarrollo de la tarea?',
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
      texto: 'Antes de comenzar una tarea el ATS debe ser revisado por el Supervisor y el personal involucrado en la tarea, llevando la firma de todos los involucrados en la tarea.',
      tipo: TipoPregunta.VERDADERO_FALSO,
      respuestaCorrecta: 'Verdadero',
    },
  ],
};
