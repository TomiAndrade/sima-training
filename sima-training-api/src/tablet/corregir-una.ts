import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { esCorrecta } from '../sesiones/corregir';
import { CorregirRespuestaDto } from './dto/corregir-respuesta.dto';

/**
 * Corrige UNA respuesta en el momento en que se toca la opción, para que la app
 * pueda pintarla verde o roja al instante.
 *
 * **Por qué esto existe y no se manda `respuestaCorrecta` en el examen.** El
 * feedback inmediato necesita saber si acertó *antes* de terminar de rendir. La
 * alternativa obvia —mandar la correcta junto con cada pregunta— la deja visible
 * en las devtools ANTES de contestar: la PWA es pública y se entra sólo con un
 * DNI, así que cualquiera con una laptop leería el JSON y sacaría 100% en una
 * certificación de seguridad laboral. Por acá la correcta se entrega recién
 * DESPUÉS de que la respuesta quedó comprometida (en la app es definitiva al
 * tocar), que es exactamente lo que se quiere enseñar y no lo que se quiere
 * filtrar. `serializar-pregunta.ts` sigue sin devolverla nunca.
 *
 * Vive en su propio archivo —y no como método de TabletService— por el mismo
 * motivo que serializarPregunta(): la usan los DOS flujos de rendición. No se
 * puso en SesionesService a propósito, porque InvitadoService no depende de
 * Sesiones (ver el comentario de la clase) y no es este cambio el que va a
 * acoplarlos: con Prisma por parámetro los dos la llaman sin conocerse.
 *
 * Lo que este endpoint NO hace, y no es un olvido:
 *
 *   - **No persiste nada.** La respuesta se guarda al cerrar la sesión, como
 *     siempre. Corregir de a una es sólo para mostrar; la corrección que vale es
 *     la de `SesionesService.registrar()`, que vuelve a correr `esCorrecta()`
 *     sobre la misma fila.
 *   - **No mira el tope de reintentos.** Eso se aplica al SERVIR el examen
 *     (TabletService.examen); acá la persona ya lo tiene en pantalla y está
 *     rindiendo.
 *   - **No filtra por `activa`**, ni en el pivot ni en la pregunta — mismo
 *     criterio que `crearSesion()`: una baja a mitad de la rendición no puede
 *     cambiar cómo se corrige lo que ya se sirvió.
 *
 * Queda un hueco conocido: como no hay estado del examen servido, se puede
 * llamar de a una opción por vez desde afuera de la app hasta dar con la
 * correcta. Ver docs/pendientes.md — cerrarlo requiere persistir qué se sorteó.
 */
export async function corregirUna(
  prisma: PrismaService,
  dto: CorregirRespuestaDto,
) {
  const version = await prisma.moduloVersion.findUnique({
    where: { id: dto.moduloVersionId },
    select: { id: true, estado: true },
  });
  if (!version) {
    throw new NotFoundException(
      `La versión de módulo ${dto.moduloVersionId} no existe`,
    );
  }
  // Mismo criterio que crearSesion(): un BORRADOR no se rinde, así que tampoco
  // hay nada que corregir contra él.
  if (version.estado === 'BORRADOR') {
    throw new ConflictException(
      'No se puede rendir un BORRADOR: la versión todavía no está publicada',
    );
  }

  // El pivot es lo que ata la pregunta a ESTE examen. Es la validación que
  // impide que el endpoint sirva de oráculo: sin ella, cualquier preguntaId del
  // banco devolvería su respuesta correcta.
  const pivot = await prisma.moduloVersionPregunta.findUnique({
    where: {
      moduloVersionId_preguntaId: {
        moduloVersionId: version.id,
        preguntaId: dto.preguntaId,
      },
    },
    select: { pregunta: { select: { respuestaCorrecta: true } } },
  });
  if (!pivot) {
    throw new BadRequestException(
      `Esta pregunta no pertenece a la versión que se está rindiendo: ${dto.preguntaId}`,
    );
  }

  const respuestaCorrecta = pivot.pregunta.respuestaCorrecta;
  if (!respuestaCorrecta) {
    // Mismo caso que en crearSesion(): hoy sólo podría pasar con TEXTO_LIBRE.
    // Se rechaza en vez de contestar "incorrecta", que le mostraría un error en
    // rojo a alguien por un dato faltante nuestro.
    throw new BadRequestException(
      `Esta pregunta no tiene respuesta correcta cargada y no se puede corregir automáticamente: ${dto.preguntaId}`,
    );
  }

  return {
    correcta: esCorrecta(respuestaCorrecta, dto.respuestaDada),
    // Se devuelve siempre, no sólo cuando erró: si acertó es la misma que mandó,
    // así que no agrega ninguna filtración, y la app arma con esto el resumen
    // final de incorrectas sin tener que pedir nada más al cerrar la sesión.
    //
    // En OPCIONES_IMAGEN es la CLAVE cruda de storage, no una URL: es con lo que
    // la app compara contra las opciones que ya tiene (ver serializarOpciones).
    respuestaCorrecta,
  };
}
