# -*- coding: utf-8 -*-
"""Correcciones de redaccion y ortografia sobre el texto que sale de los Excel.

Los Excel se escribieron a mano y arrastran erratas, faltas de acento y
concordancias rotas ("broce" por bronce, "cunado" por cuando, "Espacios
Confiados" por Confinados, "un residuos METALICOS limpios"). El contenido se
muestra en una tablet a personal de clientes de Oil & Gas, asi que se corrige.

QUE SE CORRIGE: ortografia, acentuacion, concordancia, signos de interrogacion
que faltan y redacciones que no se entienden. QUE NO: la terminologia del
cliente ni el sentido de la pregunta. "Reglas que Salvan Vidas", "Ref. SSMAC" o
"tacho" quedan como estan.

--- Por que un mapa de cadena COMPLETA y no reemplazos de palabra ---

Reemplazar por palabra ("que" -> "que" con acento) es imposible de acotar sin
romper media docena de frases donde ese "que" no es interrogativo. Escribir la
cadena entera es mas largo pero es explicito: se ve exactamente como queda cada
pregunta.

--- Por que el MISMO mapa para enunciado, opciones y respuesta correcta ---

En OPCION_MULTIPLE la respuesta correcta es UNA DE LAS OPCIONES, comparada por
igualdad de string (ver corregir.ts en el backend). Si se corrigiera la opcion
y no la respuesta, la pregunta quedaria sin ninguna opcion correcta y NADIE
podria aprobarla. Aplicando el mismo mapa a las dos, las dos reciben la misma
correccion y no se pueden desincronizar. `generar.py` ademas valida que la
correcta siga estando entre las opciones despues de corregir.
"""

# Correcciones que valen para CUALQUIER pregunta donde aparezca la cadena. La
# mayoria de las opciones se repiten entre preguntas (hay 15 que dicen "Indicar
# de que regla se trata:"), asi que una entrada arregla todas.
CORRECCIONES = {
    # --- Enunciados que se repiten entre modulos ---
    'Indicar de que regla se trata:': 'Indicar de qué regla se trata:',
    'Indique de que regla se trata.': 'Indique de qué regla se trata.',
    'Indicar de que se trata la siguiente imagen:': 'Indicar de qué se trata la siguiente imagen:',
    'Indique que significa esta imagen': 'Indique qué significa esta imagen',
    '¿Quienes deben aplicar las Reglas de Oro de Ingeniería Sima?':
        '¿Quiénes deben aplicar las Reglas de Oro de Ingeniería Sima?',
    'Quienes deben aplicar las Reglas de Oro de Ingeniería Sima?':
        '¿Quiénes deben aplicar las Reglas de Oro de Ingeniería Sima?',
    'La Política de detención de tareas, quien la puede aplicar?':
        'La Política de detención de tareas, ¿quién la puede aplicar?',
    'De que se trata esta Pirámide?': '¿De qué se trata esta Pirámide?',
    'Quien debe asegurarse que esta premisa se cumpla?':
        '¿Quién debe asegurarse de que esta premisa se cumpla?',
    'Una contravención de transito es una conducta antijurídica que se encuentra penada por la Ley Nacional de Tránsito, la misma debe ser asumida por la persona que conduzca la unidad en ese momento y lugar.':
        'Una contravención de tránsito es una conducta antijurídica penada por la Ley Nacional de Tránsito, y debe ser asumida por la persona que conduzca la unidad en ese momento y lugar.',
    'Estas son las cuatro prohibiciones cuando utilizamos un vehículo de la empresa.\n1- Ceder la conducción a personal ajeno a la empresa\n2- Transportar a personas ajenas a la Empresa\n3- Ceder la llave PIN o de ID de arranque\n4- Uso personal del vehículo':
        'Estas son las cuatro prohibiciones cuando utilizamos un vehículo de la empresa:\n1- Ceder la conducción a personal ajeno a la empresa\n2- Transportar a personas ajenas a la empresa\n3- Ceder la llave PIN o de ID de arranque\n4- Uso personal del vehículo',
    'LÍNEA DE FUEGO: Lugar donde una persona (o parte de su cuerpo) puede ser impactada, golpeada o atravesada por objetos, materiales o cualquier tipo de energía que se libera repentinamente.':
        'LÍNEA DE FUEGO: es el lugar donde una persona (o parte de su cuerpo) puede ser impactada, golpeada o atravesada por objetos, materiales o cualquier tipo de energía que se libera repentinamente.',

    # --- SIMA Basico ---
    'Indique que Regla corresponde a Excavación y Apertura': 'Indique qué Regla corresponde a Excavación y Apertura',
    'Indique que Regla corresponde carga suspendida': 'Indique qué Regla corresponde a carga suspendida',
    'Indique que Regla aplica para trabajo con equipos de izaje': 'Indique qué Regla aplica para trabajo con equipos de izaje',
    'Indique que Regla corresponde aplica a Aislamiento de Energías': 'Indique qué Regla aplica a Aislamiento de Energías',
    'Indique que Regla corresponde a Detención de Tarea': 'Indique qué Regla corresponde a Detención de Tarea',
    'Indique que Regla corresponde a Trabajo en Altura': 'Indique qué Regla corresponde a Trabajo en Altura',
    'Indique que Regla corresponde a Línea de Fuego': 'Indique qué Regla corresponde a Línea de Fuego',
    'Indique que Regla corresponde a Seguridad Vial': 'Indique qué Regla corresponde a Seguridad Vial',
    'Indique que Regla corresponde a Permiso de Trabajo': 'Indique qué Regla corresponde a Permiso de Trabajo',
    'Indique que Regla corresponde a Prohibición de consumo de Alcohol y Drogas':
        'Indique qué Regla corresponde a Prohibición de consumo de Alcohol y Drogas',
    'OPERACIONES DE ELEVACION Y MONTAJE: El equipo, los elementos, el operador y el señaleros en una tarea de izaje deben tener certificación vigentes':
        'OPERACIONES DE ELEVACIÓN Y MONTAJE: el equipo, los elementos, el operador y los señaleros en una tarea de izaje deben tener certificación vigente.',
    'La Política de DETENCION DE TAREA la aplica solo los Ref. SSAMC.':
        'La Política de DETENCIÓN DE TAREA la aplican solo los Ref. SSMAC.',
    'Nunca debemos en una maniobra de izaje circular por debajo de la carga suspendida':
        'Nunca debemos circular por debajo de la carga suspendida en una maniobra de izaje.',
    'Ajustar la velocidades a las condiciones climáticas, estado del camino, condición de iluminación es una forma de aplicar Seguridad Vial':
        'Ajustar la velocidad a las condiciones climáticas, al estado del camino y a la condición de iluminación es una forma de aplicar Seguridad Vial.',
    'Se permite fumar y/o usar cigarrillos electrónicos dentro de los tráiler u oficinas.':
        'Se permite fumar y/o usar cigarrillos electrónicos dentro de los tráileres u oficinas.',
    'En caso de eventualidades (derrames, accidentes personal, incendio, accidente de transito) debo activar el Rol de Emergencias de Ingeniería Sima que aplica a cada sitio.':
        'En caso de eventualidades (derrames, accidentes personales, incendio, accidente de tránsito) debo activar el Rol de Emergencias de Ingeniería Sima que aplica a cada sitio.',
    'En que tacho debo disponer un residuo METALICO libre de hidrocarburo':
        '¿En qué tacho debo disponer un residuo METÁLICO libre de hidrocarburo?',
    'En que tacho debo disponer un residuo BIODEGRADABLES o RECICLABLES libre de hidrocarburo':
        '¿En qué tacho debo disponer un residuo BIODEGRADABLE o RECICLABLE libre de hidrocarburo?',
    'En que tacho debo disponer los residuos CONDICIONADOS o SUELOS CONTAMINADOS':
        '¿En qué tacho debo disponer los residuos CONDICIONADOS o SUELOS CONTAMINADOS?',
    'En que tacho debo disponer los residuos contaminados con hidrocarburos y productos químicos, como filtros, trapos, guantes, suelo, aceites.':
        '¿En qué tacho debo disponer los residuos contaminados con hidrocarburos y productos químicos, como filtros, trapos, guantes, suelo o aceites?',
    'En que tacho debo disponer la yerba, resto de comida, cartones, envases plásticos libres de hidrocarburos o químicos':
        '¿En qué tacho debo disponer la yerba, los restos de comida, los cartones y los envases plásticos libres de hidrocarburos o químicos?',
    'En que tacho debo disponer los restos de chapas, cobre, broce, chatarra, libres de hidrocarburos':
        '¿En qué tacho debo disponer los restos de chapa, cobre, bronce y chatarra libres de hidrocarburos?',
    'Indique que significa este pictograma.': 'Indique qué significa este pictograma.',
    'PERMISO DE TRABAJO: Documento formal que autoriza la realización de una tarea específica, establece puntos de chequeo para verificar las condiciones y medidas de seguridad que deben seguirse para prevenir accidentes.':
        'PERMISO DE TRABAJO: es el documento formal que autoriza la realización de una tarea específica y establece los puntos de chequeo para verificar las condiciones y medidas de seguridad que deben seguirse para prevenir accidentes.',
    'Es necesario que todo personal nuevo, en un Sector, Obras o Servicios reciba una inducción en sitio de trabajo antes de comenzar las actividades.':
        'Es necesario que todo personal nuevo en un Sector, Obra o Servicio reciba una inducción en el sitio de trabajo antes de comenzar las actividades.',
    # Las tres distractoras estaban en SINGULAR y la correcta en plural: el
    # numero solo delataba la respuesta sin que hiciera falta saber nada.
    'Elemento de producción personal': 'Elementos de producción personal',
    'Equipo de prevención personal': 'Equipos de prevención personal',
    'Equipo de producción personal': 'Equipos de producción personal',
    'Indique si esta imagen corresponde a la reglas de las 3R':
        'Indique si esta imagen corresponde a la regla de las 3R.',
    'Indique cual es la posición correcta para el levantamiento manual de cargas':
        'Indique cuál es la posición correcta para el levantamiento manual de cargas.',
    'Indique en cual de las imágenes ve riesgo eléctrico o posibilidad de incendio':
        'Indique en cuál de las imágenes ve riesgo eléctrico o posibilidad de incendio.',
    'Indique cual es una postura ergonómicamente correcta':
        'Indique cuál es una postura ergonómicamente correcta.',
    'Indique cual de estos no se considera un residuo peligroso':
        'Indique cuál de estos no se considera un residuo peligroso.',
    'El término ralentí hace referencia al régimen mínimo de revoluciones a las cuales se puede mantener estable el funcionamiento de un motor de combustión interna sin requerir aceleración. Se produce cuando el vehículo esta detenido con el motor en marcha':
        'El término ralentí hace referencia al régimen mínimo de revoluciones al cual se puede mantener estable el funcionamiento de un motor de combustión interna sin requerir aceleración. Se produce cuando el vehículo está detenido con el motor en marcha.',
    'El ralentí no genera ningún inconveniente al ambiente':
        'El ralentí no genera ningún inconveniente al ambiente.',
    'Cual no es una energía renovable': '¿Cuál no es una energía renovable?',
    'Que es un EPP': '¿Qué es un EPP?',
    '¿Cual es la primera acción que debe realizar el observador ante un Cuasi - accidente?.':
        '¿Cuál es la primera acción que debe realizar el observador ante un cuasi accidente?',
    'Los vehículos de la empresa cuentan con un sistema de arranque de identificación obligatoria, por lo cual a cada conductor se le asigna una llave de uso estrictamente personal e intransferible denominada llave PIN':
        'Los vehículos de la empresa cuentan con un sistema de arranque de identificación obligatoria, por lo cual a cada conductor se le asigna una llave de uso estrictamente personal e intransferible denominada llave PIN.',
    'Se prohíbe el uso de vehículos de la empresa fuera de los horarios laborales y para uso personal':
        'Se prohíbe el uso de vehículos de la empresa fuera de los horarios laborales y para uso personal.',
    'Según el procedimiento de Mantenimiento de vehículos y equipos, es obligatorio realizar el check list forma mensual ?':
        'Según el procedimiento de Mantenimiento de vehículos y equipos, ¿es obligatorio realizar el check list de forma mensual?',
    'Toda contravención de transito deberá ser asumida por la persona que conduzca la unidad en ese momento y lugar.':
        'Toda contravención de tránsito deberá ser asumida por la persona que conduzca la unidad en ese momento y lugar.',
    'Al trasportar manualmente una carga es importante siempre poder visualizar el camino a recorrer':
        'Al transportar manualmente una carga es importante poder visualizar siempre el camino a recorrer.',
    'Para la ley de transito, las bicicletas son consideradas otro vehículo más.':
        'Para la ley de tránsito, las bicicletas son consideradas un vehículo más.',
    'El orden y la limpieza son factores claves para prevenir accidentes':
        'El orden y la limpieza son factores clave para prevenir accidentes.',
    'Debo conocer el Rol de emergencias y punto de reunión de cada sitio de trabajo.':
        'Debo conocer el Rol de Emergencias y el punto de reunión de cada sitio de trabajo.',
    'Siempre que suba o baje escaleras debo aplicar la técnica de los tres puntos de apoyo':
        'Siempre que suba o baje escaleras debo aplicar la técnica de los tres puntos de apoyo.',
    # Opciones de Basico
    'Prohibidos circular debajo de carga suspendida': 'Prohibido circular debajo de carga suspendida',
    'Aislaciones de Energía': 'Aislamiento de Energías',
    'Prohibido el consumo Alcohol y Drogas': 'Prohibido el consumo de Alcohol y Drogas',
    'Obligación saludar': 'Obligación de saludar',

    # --- SIMA Intermedio ---
    'Indique que símbolo nos indica la eficiencia energética de un electrodoméstico':
        'Indique qué símbolo nos indica la eficiencia energética de un electrodoméstico.',
    'Indique que significa estas imágenes': 'Indique qué significan estas imágenes',
    # El Excel numera 1, 2, 3, 5, 6: se saltea el 4 y son cinco reglas.
    'Las Reglas de Oro para trabajo en equipos y sistemas eléctricos sin tensión son:\n1. Corte Visible\n2. Enclavamiento y bloqueo\n3. Verificación de ausencia de tensión\n5. Puesta a tierra y cortocircuito\n6. Señalización de la zona':
        'Las Reglas de Oro para trabajo en equipos y sistemas eléctricos sin tensión son:\n1. Corte visible\n2. Enclavamiento y bloqueo\n3. Verificación de ausencia de tensión\n4. Puesta a tierra y en cortocircuito\n5. Señalización de la zona',
    'Es necesario que todo personal nuevo en el Sector, Obras, Servicios reciba una inducción en sitio de trabajo antes de comenzar las actividades.':
        'Es necesario que todo personal nuevo en un Sector, Obra o Servicio reciba una inducción en el sitio de trabajo antes de comenzar las actividades.',
    'En un ESPACIO CONFINADO debo verificar y registrar las condiciones de la atmosfera mediante equipos de medición calibrados y personal competente.':
        'En un ESPACIO CONFINADO debo verificar y registrar las condiciones de la atmósfera mediante equipos de medición calibrados y personal competente.',
    'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar presiones residuales.':
        'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar las presiones residuales.',
    'Indique que es el Ralentí': '¿Qué es el ralentí?',
    'El ralentí genera impacto en el ambiente y desgaste en el motor':
        'El ralentí genera impacto en el ambiente y desgaste en el motor.',
    'Todo producto químico debe estar etiquetado según SGA':
        'Todo producto químico debe estar etiquetado según el SGA.',
    'Estos Pictogramas corresponden a los productos químicos según el SGA - Sistema Globalmente Armonizado':
        'Estos pictogramas corresponden a los productos químicos según el SGA (Sistema Globalmente Armonizado).',
    'Cual es el propósito de realizar simulacros en sitios de trabajo':
        '¿Cuál es el propósito de realizar simulacros en los sitios de trabajo?',
    'Cuando un vehículo viene de frente por el mismo carril, debemos aplicar la regla de las cuatro "M"\n1- Mirar la Ruta\n2- Mantener la derecha\n3- Mermar la Velocidad\n4- Maniobrar hacia afuera de la ruta':
        'Cuando un vehículo viene de frente por el mismo carril, debemos aplicar la regla de las cuatro "M":\n1- Mirar la ruta\n2- Mantener la derecha\n3- Mermar la velocidad\n4- Maniobrar hacia afuera de la ruta',
    'Quienes deben confeccionar una tarjeta de observación si se advierte de un desvío?':
        '¿Quiénes deben confeccionar una tarjeta de observación si se advierte un desvío?',
    'Confeccionar tarjetas de observaciones, participar en la confección de un IPER, proponer una oportunidad de mejora es una forma de Participación y Consulta de los Trabajadores.':
        'Confeccionar tarjetas de observación, participar en la confección de un IPER o proponer una oportunidad de mejora son formas de Participación y Consulta de los Trabajadores.',
    'Quien debe identificar condiciones y acciones inseguras?':
        '¿Quién debe identificar condiciones y acciones inseguras?',
    'PROHIBIDO retirar o remover dispositivos de bloqueo y/o etiquetas en los equipos que no fueron colocados por mí.':
        'Está PROHIBIDO retirar o remover dispositivos de bloqueo y/o etiquetas que no fueron colocados por mí.',
    # Opciones de Intermedio
    'No cumplir con los mantenimiento programados': 'No cumplir con los mantenimientos programados',
    'Para conocer como activar el rol de emergencias': 'Para conocer cómo activar el rol de emergencias',
    'La Regla de los 5 puntos de apoyo': 'La regla de los 5 puntos de apoyo',
    'Las 5 reglas de oro para trabajo sin tensión': 'Las 5 Reglas de Oro para trabajo sin tensión',

    # --- SIMA Avanzado ---
    'Es un punto de la Política del Sistema Integrado de Gestión " Cumplir con los requisitos y expectativas de sus cliente y demás partes interesadas"':
        'Es un punto de la Política del Sistema Integrado de Gestión: "Cumplir con los requisitos y expectativas de sus clientes y demás partes interesadas".',
    'Es un punto de la Política del Sistema Integrado de Gestión " Concientizar a todos los integrantes de la organización para dar cumplimiento a esta Política"':
        'Es un punto de la Política del Sistema Integrado de Gestión: "Concientizar a todos los integrantes de la organización para dar cumplimiento a esta Política".',
    'Es un punto de la Política del Sistema Integrado de Gestión "Aplicar los requisitos legales, practica de trabajo seguro y protección ambiental solo cuando el cliente los solicite"':
        'Es un punto de la Política del Sistema Integrado de Gestión: "Aplicar los requisitos legales, las prácticas de trabajo seguro y la protección ambiental solo cuando el cliente los solicite".',
    'Es un punto de la Política del Sistema Integrado de Gestión "Promover la eliminación de peligros y reducción de riesgos en la gestión de Seguridad y Salud en el Trabajo"':
        'Es un punto de la Política del Sistema Integrado de Gestión: "Promover la eliminación de peligros y la reducción de riesgos en la gestión de Seguridad y Salud en el Trabajo".',
    'Es un punto de la Política del Sistema Integrado de Gestión "Cumplir con los requisitos legales y otros requisitos aplicables solo cuando sea posible"':
        'Es un punto de la Política del Sistema Integrado de Gestión: "Cumplir con los requisitos legales y otros requisitos aplicables solo cuando sea posible".',
    'Según la Política de Ingeniería Sima "Las practicas seguras de trabajo es responsabilidad …"':
        'Según la Política de Ingeniería Sima, "las prácticas seguras de trabajo son responsabilidad…"',
    'Nuestra Visión: "Ser la opción más confiable en la producción de hidrocarburos y en la generación de otras formas de energías"':
        'Nuestra Visión es "ser la opción más confiable en la producción de hidrocarburos y en la generación de otras formas de energía".',
    'Nuestra Visión: "Ser la empresa mejor vista y optimista del mercado"':
        'Nuestra Visión es "ser la empresa mejor vista y más optimista del mercado".',
    'Nuestra Misión: “Ofrecer ventajas competitivas a nuestros clientes: calidad, bajos costos, y rapidez, basadas en los criterios máximos de la industria en cuanto salud, seguridad, medio ambiente y responsabilidad social”':
        'Nuestra Misión es "ofrecer ventajas competitivas a nuestros clientes —calidad, bajos costos y rapidez— basadas en los criterios máximos de la industria en cuanto a salud, seguridad, medio ambiente y responsabilidad social".',
    'Este es el alcance que Ingeniería Sima tiene certificado: “Ingeniería, ejecución, montaje y puesta en marcha de proyectos constructivos, tipo “llave en mano”. Servicio de movimiento de suelos. Servicio de operación y mantenimiento de yacimientos de petróleo y gas. “':
        'Este es el alcance que Ingeniería Sima tiene certificado: "Ingeniería, ejecución, montaje y puesta en marcha de proyectos constructivos tipo llave en mano. Servicio de movimiento de suelos. Servicio de operación y mantenimiento de yacimientos de petróleo y gas".',
    'La ISO 14001 es una norma internacional que proporciona orientación respecto a como gestionar los aspectos medioambientales de una organización.':
        'La ISO 14001 es una norma internacional que proporciona orientación respecto a cómo gestionar los aspectos medioambientales de una organización.',
    'La norma ISO 14001 es una norma internacional que establece los requisitos para un Sistema de Gestión de Salud y Seguridad Ocupacional (SST)':
        'La ISO 14001 es una norma internacional que establece los requisitos para un Sistema de Gestión de Salud y Seguridad Ocupacional (SST).',
    'RIESGO: Es la combinación de la probabilidad de ocurrencia y de la consecuencia de un determinado evento peligroso.':
        'RIESGO: es la combinación de la probabilidad de ocurrencia y la consecuencia de un determinado evento peligroso.',
    'PELIGRO: Es un agente (material o energía) con potencial para provocar daños en las personas, instalaciones, equipos, materiales y al medio ambiente.':
        'PELIGRO: es un agente (material o energía) con potencial para provocar daños en las personas, las instalaciones, los equipos, los materiales y el medio ambiente.',
    'Para que utiliza esta herramienta ?': '¿Para qué se utiliza esta herramienta?',
    'Que significa el termino Ergonomía': '¿Qué significa el término Ergonomía?',
    'Cuando se realicen trabajos fuera de los horarios habituales, fines de semana o feriado el supervisor o jefe de obra debe enviar un comunicación al mail a trabajonorutinario@sima.com.ar indicando la actividad que se va a realizar y personal afectado, este mail informa a Dirección, Gerencias, SSMAC, RRHH':
        'Cuando se realicen trabajos fuera de los horarios habituales, fines de semana o feriados, el supervisor o jefe de obra debe enviar una comunicación a trabajonorutinario@sima.com.ar indicando la actividad que se va a realizar y el personal afectado. Ese mail informa a Dirección, Gerencias, SSMAC y RRHH.',
    'Si se va a realizar un trabajo fuera de los horarios habituales o fines de semana no es necesario dar aviso, solo se debe pasar las horas a RRHH.':
        'Si se va a realizar un trabajo fuera de los horarios habituales o fines de semana no es necesario dar aviso: solo se deben pasar las horas a RRHH.',
    'Es un objetivo disminuir la recepción de mail al comomanejo@sima.com.ar, por parte de la comunidad por causas y conductas impropias de nuestros conductores.':
        'Es un objetivo disminuir los mails que la comunidad envía a comomanejo@sima.com.ar por causas y conductas impropias de nuestros conductores.',
    'Como puedo mejorar mi conducta proactiva': '¿Cómo puedo mejorar mi conducta proactiva?',
    'Es responsabilidad de los Jefes de Obras, Jefes de Servicios y Referentes de SSMAC destinar un espacio de tiempo para realizar una inducción en sitio de trabajo antes de que el nuevo empleado comience las actividades, dejando registro de la misma.':
        'Es responsabilidad de los Jefes de Obra, Jefes de Servicio y Referentes de SSMAC destinar un espacio de tiempo para realizar una inducción en el sitio de trabajo antes de que el nuevo empleado comience las actividades, dejando registro de ella.',
    'En actividad EXCAVACIONES o ZANJEO en zonas de baterías o plantas, no es necesario realizar la geo detección de interferencias.':
        'En actividades de EXCAVACIÓN o ZANJEO en zonas de baterías o plantas no es necesario realizar la geodetección de interferencias.',
    'En el procedimiento de Gestión de la Organización define las herramientas que dispone la empresa para la Participación y Consulta de los Trabajadores ( confección y revisión de los IPER, tarjetas de observaciones, participación en la confección de procedimientos e instructivos, Sima Check, etc.)':
        'El procedimiento de Gestión de la Organización define las herramientas de las que dispone la empresa para la Participación y Consulta de los Trabajadores (confección y revisión de los IPER, tarjetas de observación, participación en la confección de procedimientos e instructivos, Sima Check, etc.).',
    'Que hace Ingeniería Sima en la industria?': '¿Qué hace Ingeniería Sima en la industria?',
    # Opciones de Avanzado
    'Confeccionando Tarjetas de Observaciones, Auditorias de campo, Visitas Gerenciales':
        'Confeccionando tarjetas de observación, auditorías de campo y visitas gerenciales',
    'Ejecutar Obras y ofrecer Servicios enfocados en satisfacer las necesidades de nuestros clientes':
        'Ejecuta Obras y ofrece Servicios enfocados en satisfacer las necesidades de nuestros clientes',
    'Hace Obras de ductos, movimiento de suelo, construcción de plantas':
        'Hace Obras de ductos, movimiento de suelos y construcción de plantas',
    'Capacitar al personal en uso adecuado de EPP': 'Capacitar al personal en el uso adecuado de EPP',

    # --- Reglas de Oro ---
    'Quien PUEDE y DEBE aplicar las Regla de Oro': '¿Quién PUEDE y DEBE aplicar las Reglas de Oro?',
    'Indique que Regla de Oro corresponde a Espacio Confinado': 'Indique qué Regla de Oro corresponde a Espacio Confinado',
    'Indique que Regla de Oro corresponde a Línea de fuego': 'Indique qué Regla de Oro corresponde a Línea de Fuego',
    'Indique que Regla de Oro corresponde a Operaciones de Izado': 'Indique qué Regla de Oro corresponde a Operaciones de Izado',
    'Indique que Regla de Oro aplica a Aislamiento de Energías': 'Indique qué Regla de Oro aplica a Aislamiento de Energías',
    'Indique que Regla de Oro aplica a Manejo del Cambio': 'Indique qué Regla de Oro aplica a Manejo del Cambio',
    'Indique que Regla de Oro aplica a la Seguridad Vial…': 'Indique qué Regla de Oro aplica a Seguridad Vial',
    'Indique que Regla de Oro aplica Permiso de Trabajo': 'Indique qué Regla de Oro aplica a Permiso de Trabajo',
    'Indique que Regla de Oro aplica a Trabajos en Altura': 'Indique qué Regla de Oro aplica a Trabajo en Altura',
    'Ante una situación insegura, Suspender la Tarea. Es un derecho y una responsabilidad …':
        'Ante una situación insegura, suspender la tarea es un derecho y una responsabilidad…',
    'En un ESPACIO CONFINADO debo verificar y registrar las condiciones de la atmosfera mediante equipos de medición calibrados y personal competente':
        'En un ESPACIO CONFINADO debo verificar y registrar las condiciones de la atmósfera mediante equipos de medición calibrados y personal competente.',
    'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar el bloqueo de la fuente':
        'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar el bloqueo de la fuente.',
    'PERMISO DE TRABAJO: Debe estar debidamente autorizado, identificado los peligros y salvaguardas correspondientes a cada paso de la tarea.':
        'PERMISO DE TRABAJO: debe estar debidamente autorizado, con los peligros y las salvaguardas correspondientes identificados para cada paso de la tarea.',
    'OPERACIONES DE IZADO: El equipo y los elementos de izaje deben tener certificación vigentes':
        'OPERACIONES DE IZADO: el equipo y los elementos de izaje deben tener certificación vigente.',
    'SEGURIDAD VIAL: Cumplir con las normas de Seguridad Vial solo dentro de los yacimientos':
        'SEGURIDAD VIAL: hay que cumplir con las normas de Seguridad Vial solo dentro de los yacimientos.',
    'TRABAJO EN ALTURA: El operario debe contar con la aptitud psicofísica, capacitaciones y entrenamiento para realizar tareas en altura.':
        'TRABAJO EN ALTURA: el operario debe contar con la aptitud psicofísica, las capacitaciones y el entrenamiento para realizar tareas en altura.',
    'MANEJO DEL CAMBIO: En una gestión de cambio se evalúa con el personal afectado a la tarea las nuevas condiciones, revisando los análisis de riegos realizados según la nueva condición':
        'MANEJO DEL CAMBIO: en una gestión de cambio se evalúan las nuevas condiciones con el personal afectado a la tarea, revisando los análisis de riesgo realizados según la nueva condición.',
    'AISLAMIENTO DE ENERGÍA: Es aislar todas las fuentes de energía identificadas, bloquear y etiquetar de modo de impedir el accionamiento de forma erronea.':
        'AISLAMIENTO DE ENERGÍA: es aislar todas las fuentes de energía identificadas, bloquear y etiquetar de modo de impedir el accionamiento de forma errónea.',
    # Opciones de Reglas de Oro
    'Manejo de Cambio': 'Manejo del Cambio',
    'Seguridad vial': 'Seguridad Vial',
    'Operaciones de izado': 'Operaciones de Izado',
    'Aislamiento de energías': 'Aislamiento de Energías',

    # --- Phoenix ---
    # El Excel alterna "Indique que Reglas ... aplica" y "Indique que Regla que
    # Salvan Vidas ...", que no concuerdan en numero. Se unifica en "cual de las
    # Reglas que Salvan Vidas (RSV)", que deja el nombre del programa intacto.
    'Indique que Reglas que Salvan Vidas (RSV) aplica a Trabajos en Altura …':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) aplica a Trabajo en Altura.',
    'Indique que Reglas que Salvan Vidas (RSV) corresponde a Excavación':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Excavación.',
    'Indique que Reglas que Salvan Vidas (RSV) corresponde a Espacios Confiados':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Espacios Confinados.',
    'Indique que Reglas que Salvan Vidas (RSV) corresponde a Trabajo en Caliente':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Trabajo en Caliente.',
    'Indique que Regla que Salvan Vidas (RSV) corresponde a Aislamiento de energía.':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Aislamiento de Energía.',
    'Indique que Regla que Salvan Vidas (RSV) corresponde a Izaje.':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Izaje.',
    'Indique que Regla que Salvan Vidas (RSV) corresponde a Conducción de Vehículos.':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Conducción de Vehículos.',
    'Indique que Regla que Salvan Vidas (RSV) aplica a Línea de fuego.':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) aplica a Línea de Fuego.',
    'Indique que Regla que Salvan Vidas (RSV) corresponde a Permiso de Trabajo':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Permiso de Trabajo.',
    'Indique que Regla que Salvan Vidas (RSV) corresponde a Barrera de control de riesgo degradada.':
        'Indique cuál de las Reglas que Salvan Vidas (RSV) corresponde a Barrera de control de riesgo degradada.',
    'Indique a que Reglas que Salvan Vidas (RSV) corresponde':
        'Indique a cuál de las Reglas que Salvan Vidas (RSV) corresponde',
    'Quien PUEDE y DEBE aplicar las Reglas que Salvan Vidas (RSV)':
        '¿Quién PUEDE y DEBE aplicar las Reglas que Salvan Vidas (RSV)?',
    'Quien PUEDE y DEBE aplicar la Autoridad para Detener una Tarea y revisar la actividad cunado se vulnere una o más Reglas que Salvan Vidas (RSV)':
        '¿Quién PUEDE y DEBE aplicar la Autoridad para Detener una Tarea y revisar la actividad cuando se vulnere una o más Reglas que Salvan Vidas (RSV)?',
    'En que recipiente debo disponer un residuo PLASTICO libre de hidrocarburo9.':
        '¿En qué recipiente debo disponer un residuo PLÁSTICO libre de hidrocarburo?',
    'En que recipiente debo disponer un residuo BIODEGRADABLE (restos de comida, papel, cartón, maderas, etc.)':
        '¿En qué recipiente debo disponer un residuo BIODEGRADABLE (restos de comida, papel, cartón, madera, etc.)?',
    'En que recipiente debo disponer un residuo de VIDRIO libre de hidrocarburo.':
        '¿En qué recipiente debo disponer un residuo de VIDRIO libre de hidrocarburo?',
    'En que tacho debo disponer un residuo CONTAMINADOS CON HIDROCARBUROS':
        '¿En qué recipiente debo disponer un residuo CONTAMINADO CON HIDROCARBUROS?',
    'En que recipiente debo disponer un residuos METALICOS limpios sin hidrocarburos (caños, electrodos, recortes de chapa, latas, etc.)':
        '¿En qué recipiente debo disponer los residuos METÁLICOS limpios, sin hidrocarburos (caños, electrodos, recortes de chapa, latas, etc.)?',
    'Quien tiene la responsabilidad de identificar claramente las medidas de control para prevenir y mitigar los riesgos.':
        '¿Quién tiene la responsabilidad de identificar claramente las medidas de control para prevenir y mitigar los riesgos?',
    '¿Quien es el responsable de discutir el ATS con el personal que va a realizar la tarea y asegurarse de que se apliquen los controles necesarios antes y durante el desarrollo de la tarea?':
        '¿Quién es el responsable de discutir el ATS con el personal que va a realizar la tarea y de asegurarse de que se apliquen los controles necesarios antes y durante su desarrollo?',
    'En el proceso de AISLAMIENTO DE ENERGIAS puedo intervenir el equipo sin comprobar el bloqueo de la fuente.':
        'En el proceso de AISLAMIENTO DE ENERGÍAS puedo intervenir el equipo sin comprobar el bloqueo de la fuente.',
    'Un ESPACIO CONFINADO es cualquier espacio con aberturas limitadas de entrada y salida y/o cuya ventilación natural sea o pueda ser desfavorable y que pueda contener productos peligrosos':
        'Un ESPACIO CONFINADO es cualquier espacio con aberturas limitadas de entrada y salida, y/o cuya ventilación natural sea o pueda ser desfavorable, y que pueda contener productos peligrosos.',
    'Un trabajo en Caliente es un trabajos que pueden producir una fuente de ignición de materiales inflamables o combustibles presentes en el entorno.':
        'Un TRABAJO EN CALIENTE es un trabajo que puede producir una fuente de ignición de los materiales inflamables o combustibles presentes en el entorno.',
    'Una Barrera de control de riesgos degradada, es aquella que por mal funcionamiento y/o deterioro no cumple la función para la cual fue diseñada, aumentando el riesgo de ocurrencia de un incidente mayor.':
        'Una barrera de control de riesgos degradada es aquella que, por mal funcionamiento y/o deterioro, no cumple la función para la cual fue diseñada, aumentando el riesgo de ocurrencia de un incidente mayor.',
    'Aislamiento de energía, es un sistema mediante el cual un equipo, instalación o proceso es aislado de modo efectivo de la fuente de energía que lo acciona.':
        'El AISLAMIENTO DE ENERGÍA es un sistema mediante el cual un equipo, instalación o proceso es aislado de modo efectivo de la fuente de energía que lo acciona.',
    'Izaje: Operación que permite el levantamiento y suspensión de cargas de manera segura y controlada, mediante equipos aptos y habilitados para ese fin.':
        'IZAJE: operación que permite el levantamiento y la suspensión de cargas de manera segura y controlada, mediante equipos aptos y habilitados para ese fin.',
    'Conducción vehicular, es la acción del conductor para hacerlo funcionar de manera controlada, teniendo en cuenta la capacidades del vehículo y cumplimento las reglas que apliquen':
        'La CONDUCCIÓN VEHICULAR es la acción del conductor para hacer funcionar el vehículo de manera controlada, teniendo en cuenta sus capacidades y cumpliendo las reglas que apliquen.',
    'Línea de Fuego, es un área de proyección y contacto con partes de instalaciones, equipos, cargas, vehículos y maquinas':
        'La LÍNEA DE FUEGO es un área de proyección y contacto con partes de instalaciones, equipos, cargas, vehículos y máquinas.',
    'Trabajo en Altura, es toda tarea que involucre circular o trabajar a un nivel cuya diferencia de cota sea igual o mayor a 2 metros.':
        'El TRABAJO EN ALTURA es toda tarea que involucre circular o trabajar a un nivel cuya diferencia de cota sea igual o mayor a 2 metros.',
    'Excavación, es una cavidad o depresión en el terreno hecha por el hombre, ya sea en forma manual o mecánicas.':
        'Una EXCAVACIÓN es una cavidad o depresión en el terreno hecha por el hombre, ya sea en forma manual o mecánica.',
    'Las reglas que salvan vidas son requisitos mínimos necesarios a aplicar por la totalidad del personal que trabaja diariamente en las operaciones de Phoenix Global Resources (PGR), para facilitar la prevención de riesgos con consecuencias fatales o graves.':
        'Las Reglas que Salvan Vidas son requisitos mínimos que debe aplicar la totalidad del personal que trabaja diariamente en las operaciones de Phoenix Global Resources (PGR), para facilitar la prevención de riesgos con consecuencias fatales o graves.',
    'Permanecer debajo de una carga suspendida no es considerado estar en la línea de fuego':
        'Permanecer debajo de una carga suspendida no se considera estar en la línea de fuego.',
    'Ante cambios en las condiciones de trabajo, se debe detener la actividad y reevaluar':
        'Ante cambios en las condiciones de trabajo se debe detener la actividad y reevaluar.',
    'La SEGURIDAD es un compromiso …': 'La SEGURIDAD es un compromiso…',
    'El ATS no es necesario discutirlo o difundirlo en el frente de trabajo antes de comenzar las tareas.':
        'No es necesario discutir ni difundir el ATS en el frente de trabajo antes de comenzar las tareas.',
    'Antes de comenzar una tarea el ATS debe ser revisado por el Supervisor y el personal involucrado en la tarea, llevando la firma de todos los involucrados en la tarea.':
        'Antes de comenzar una tarea, el ATS debe ser revisado por el Supervisor y el personal involucrado, y llevar la firma de todos ellos.',
    'En trabajos en altura es obligatorio usar sistema de control de caídas y estar siempre conectado a un punto de anclaje apto.':
        'En trabajos en altura es obligatorio usar un sistema de control de caídas y estar siempre conectado a un punto de anclaje apto.',
    # Opciones de Phoenix
    'Solo los Supervisor': 'Solo los Supervisores',
    'Barrera de control de riego': 'Barrera de control de riesgo',
    'Conducción de vehículos': 'Conducción de Vehículos',
    'Aislamiento de energía': 'Aislamiento de Energía',
    'Trabajo en caliente': 'Trabajo en Caliente',
    'Espacio confinado': 'Espacio Confinado',
    'Línea de fuego': 'Línea de Fuego',
}

# Correcciones que dependen del CONTEXTO: la misma cadena esta bien en una
# pregunta y mal en otra, asi que no pueden ir en el mapa global.
#
# El caso son las opciones "…del Supervisor" / "…de todo el personal". Con el
# enunciado "Las practicas seguras de trabajo son responsabilidad…" el "de" es
# correcto; con "¿Quien debe asegurarse de que esta premisa se cumpla?" hay que
# responder "el Supervisor", no "del Supervisor".
#
# La clave es (slug, numero de pregunta dentro del modulo, empezando en 1).
CORRECCIONES_POR_PREGUNTA = {
    ('intermedio', 24): {
        'el que ejecuta el trabajo': 'El que ejecuta el trabajo',
        'todo el personal': 'Todo el personal',
        'el Referente SSMAC': 'El Referente SSMAC',
        'del Supervisor': 'El Supervisor',
    },
    ('intermedio', 26): {
        'el que ejecuta el trabajo': 'El que ejecuta el trabajo',
        'todo el personal': 'Todo el personal',
        'el Referente SSMAC': 'El Referente SSMAC',
        'del Supervisor': 'El Supervisor',
    },
    ('avanzado', 33): {
        'el que ejecuta el trabajo': 'El que ejecuta el trabajo',
        'todo el personal': 'Todo el personal',
        'el Referente SSMAC': 'El Referente SSMAC',
        'del Supervisor': 'El Supervisor',
    },
    # Enunciado "¿Quien PUEDE y DEBE aplicar las Reglas de Oro?": las opciones
    # venian con los puntos suspensivos y el "del" de la pregunta 18 ("es un
    # derecho y una responsabilidad …"), donde si concuerdan.
    ('reglas-oro', 1): {
        '...Solo del Técnico de Seguridad': 'Solo el Técnico de Seguridad',
        '…Solo del Supervisor': 'Solo el Supervisor',
        '…mi compañero': 'Mi compañero',
        '... todos': 'Todos',
    },
    ('reglas-oro', 18): {
        '...Solo del Técnico de Seguridad': '…solo del Técnico de Seguridad',
        '…Solo del Supervisor': '…solo del Supervisor',
        '…de Todos': '…de todos',
        '… de la Operadora': '…de la Operadora',
    },
    ('phoenix', 2): {
        '...Solo del Técnico de Seguridad': '…solo del Técnico de Seguridad',
        '…Solo del Supervisor': '…solo del Supervisor',
    },
}
