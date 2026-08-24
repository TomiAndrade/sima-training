/**
 * Siembra rendiciones simuladas para poder ver con datos reales el tab
 * Estadísticas y el "Ver intento" de la hoja de vida.
 *
 * ⚠️ **SÓLO PARA ENTORNOS DE DESARROLLO.** Crea `Sesion` que nadie rindió: una
 * base con esto adentro no sirve como registro de capacitación. No correrlo
 * nunca contra la base de producción.
 *
 *   npx ts-node scripts/sembrar-rendiciones.ts
 *
 * Variables de entorno (todas opcionales):
 *   RENDICIONES_PERSONAS   cuántas personas rinden           (default: todas)
 *   RENDICIONES_INTENTOS   intentos máximos por asignación   (default: 2)
 *   RENDICIONES_LIMPIAR    'true' borra las sesiones sembradas antes de empezar
 *
 * **Reusa `SesionesService.registrar()`** en vez de escribir `INSERT` crudos,
 * igual que `sembrarSimaCheck()` reusa los services del seed: así las sesiones
 * pasan por la corrección real, el umbral congelado de la versión y el
 * completado de `Asignacion.moduloVersionId` al aprobar. Nada que el backend no
 * hubiera producido por sí mismo.
 *
 * Las respuestas NO son al azar uniforme, y eso es el punto: cada pregunta
 * recibe una dificultad DETERMINÍSTICA derivada del hash de su id, y las
 * incorrectas eligen una distractora sesgada. Con ruido uniforme el ranking de
 * "más falladas" y la distribución de opciones saldrían planos, que es
 * justamente lo que estas pantallas tienen que poder mostrar.
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SesionesService } from '../src/sesiones/sesiones.service';
import { sortear } from '../src/tablet/sorteo';
import { PREGUNTAS_POR_EXAMEN } from '../src/tablet/tablet.service';

const OPCIONES_VERDADERO_FALSO = ['Verdadero', 'Falso'];

const personasTope = Number(process.env.RENDICIONES_PERSONAS ?? 0);
const intentosMax = Number(process.env.RENDICIONES_INTENTOS ?? 2);
const limpiar = process.env.RENDICIONES_LIMPIAR === 'true';

// Hash estable de un string a [0, 1). Determinístico entre corridas: la misma
// pregunta tiene siempre la misma dificultad, así el ranking no cambia de forma
// cada vez que se resiembra.
function hash01(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// Probabilidad de que alguien acierte esta pregunta. Entre 0.35 y 0.97 para que
// el ranking tenga fondo y techo: unas pocas preguntas realmente difíciles,
// muchas intermedias, y algunas que no falla nadie (las "triviales" del
// reporte).
const dificultad = (preguntaId: string) => 0.35 + hash01(preguntaId) * 0.62;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const prisma = app.get(PrismaService);
  const sesiones = app.get(SesionesService);

  if (limpiar) {
    // Las respuestas primero: son hijas y la FK no tiene cascade.
    const borradas = await prisma.$transaction(async (tx) => {
      const sembradas = await tx.sesion.findMany({
        where: { createdBy: 'siembra-dev' },
        select: { id: true, asignacionId: true },
      });
      const ids = sembradas.map((s) => s.id);
      await tx.respuesta.deleteMany({ where: { sesionId: { in: ids } } });
      // Al aprobar, `registrar()` dejó la asignación apuntando a la versión con
      // la que se cumplió. Hay que soltar ESAS asignaciones (sólo las que
      // tocó la siembra, nunca las cumplidas de verdad) o el delete choca
      // contra la FK Restrict de Sesion.asignacion.
      const tocadas = sembradas
        .map((s) => s.asignacionId)
        .filter((id): id is string => id !== null);
      await tx.asignacion.updateMany({
        where: { id: { in: tocadas } },
        data: { moduloVersionId: null },
      });
      await tx.sesion.deleteMany({ where: { id: { in: ids } } });
      return ids.length;
    });
    console.log(`Limpiadas ${borradas} sesiones sembradas.`);
  }

  const asignaciones = await prisma.asignacion.findMany({
    where: { revocadaAt: null, usuario: { deletedAt: null } },
    select: {
      id: true,
      usuarioId: true,
      moduloId: true,
      modulo: { select: { nombre: true } },
    },
    orderBy: { usuarioId: 'asc' },
  });

  if (asignaciones.length === 0) {
    console.error(
      'No hay ninguna asignación vigente: no hay a quién hacerle rendir nada.\n' +
        'Importá la nómina desde el backoffice (Usuarios → Importar Excel) contra\n' +
        '"Ingeniería SIMA" y volvé a correr este script. Las reglas del seed\n' +
        '(SEED_SIMA_CHECK=true) materializan las asignaciones solas al importar.',
    );
    await app.close();
    process.exit(1);
  }

  // Tope de personas, si se pidió. Se recorta por persona y no por asignación
  // para no dejar a alguien con la mitad de sus módulos rendidos.
  const usuarios = [...new Set(asignaciones.map((a) => a.usuarioId))];
  const elegidos = new Set(
    personasTope > 0 ? usuarios.slice(0, personasTope) : usuarios,
  );

  // La versión ACTIVO de cada módulo, con su pool y sus parámetros. Una query
  // para todos los módulos en vez de una por asignación.
  const versiones = await prisma.moduloVersion.findMany({
    where: {
      estado: 'ACTIVO',
      moduloId: { in: [...new Set(asignaciones.map((a) => a.moduloId))] },
    },
    select: {
      id: true,
      moduloId: true,
      preguntasPorExamen: true,
      preguntas: {
        where: { activa: true },
        select: {
          pregunta: {
            select: {
              id: true,
              tipo: true,
              opciones: true,
              respuestaCorrecta: true,
            },
          },
        },
      },
    },
  });
  const versionDe = new Map(versiones.map((v) => [v.moduloId, v]));

  let creadas = 0;
  let aprobadas = 0;
  let salteadas = 0;

  for (const asignacion of asignaciones) {
    if (!elegidos.has(asignacion.usuarioId)) continue;

    const version = versionDe.get(asignacion.moduloId);
    if (!version || version.preguntas.length === 0) {
      salteadas++;
      continue;
    }

    // Se rinde hasta aprobar o hasta agotar los intentos, que es el
    // comportamiento real: quien desaprueba reintenta.
    for (let intento = 1; intento <= intentosMax; intento++) {
      const pool = version.preguntas.map((p) => p.pregunta);
      const sorteadas = sortear(
        pool,
        version.preguntasPorExamen ?? PREGUNTAS_POR_EXAMEN,
      );

      const respuestas = sorteadas.map((pregunta) => {
        const opciones =
          pregunta.tipo === 'VERDADERO_FALSO'
            ? OPCIONES_VERDADERO_FALSO
            : Array.isArray(pregunta.opciones)
              ? (pregunta.opciones as string[])
              : [];

        const acierta = Math.random() < dificultad(pregunta.id);
        if (acierta || !pregunta.respuestaCorrecta) {
          return {
            preguntaId: pregunta.id,
            respuestaDada: pregunta.respuestaCorrecta,
          };
        }

        const distractoras = opciones.filter(
          (o) => o !== pregunta.respuestaCorrecta,
        );
        if (distractoras.length === 0) {
          // Sin distractoras conocidas: se cuenta como no contestada, que es un
          // estado real del modelo (`respuestaDada` nullable).
          return { preguntaId: pregunta.id, respuestaDada: null };
        }
        // Sesgada y no uniforme: la mayoría cae en la MISMA distractora, que es
        // el patrón que revela una opción ambigua en el reporte.
        const favorita = Math.floor(hash01(pregunta.id) * distractoras.length);
        const elegida =
          Math.random() < 0.7
            ? favorita
            : Math.floor(Math.random() * distractoras.length);
        return {
          preguntaId: pregunta.id,
          respuestaDada: distractoras[elegida],
        };
      });

      const finalizadaEn = new Date(
        Date.now() - Math.floor(Math.random() * 120) * 24 * 60 * 60 * 1000,
      );

      const sesion = await sesiones.registrar(
        {
          usuarioId: asignacion.usuarioId,
          moduloVersionId: version.id,
          asignacionId: asignacion.id,
          iniciadaEn: new Date(finalizadaEn.getTime() - 10 * 60 * 1000),
          finalizadaEn,
          respuestas,
          // Determinística: dos corridas del script no duplican los mismos
          // intentos, los deduplica el índice único de claveIdempotencia.
          claveIdempotencia: `siembra-${asignacion.id}-${intento}`,
        },
        'siembra-dev',
      );

      if (!sesion.duplicada) creadas++;
      if (sesion.aprobada) {
        aprobadas++;
        break;
      }
    }
  }

  console.log(
    `Listo: ${creadas} sesiones nuevas (${aprobadas} aprobadas) sobre ${elegidos.size} personas.` +
      (salteadas
        ? `\n${salteadas} asignaciones salteadas: su módulo no tiene versión ACTIVO con preguntas.`
        : ''),
  );

  await app.close();
}

main().catch(async (err) => {
  console.error(err);
  await new PrismaClient().$disconnect();
  process.exit(1);
});
