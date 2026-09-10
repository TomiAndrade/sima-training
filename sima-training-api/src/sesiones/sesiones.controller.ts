import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LECTURA_BACKOFFICE } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { SesionesService } from './sesiones.service';

@Controller('sesiones')
export class SesionesController {
  constructor(private readonly sesiones: SesionesService) {}

  /**
   * El detalle de UN intento: qué se preguntó, qué contestó la persona, si
   * estuvo bien y cuál era la correcta. Lo consume "Ver intento" en la hoja de
   * vida del backoffice.
   *
   * ⚠️ **No es la única lectura del proyecto con guard** (todas las
   * lecturas del backoffice requieren sesión ahora — se cerraron los GET
   * que eran `@Public()` de más), pero sí sigue siendo la única que expone
   * `Pregunta.respuestaCorrecta`, y por eso el motivo del guard acá es otro:
   * bloquear a alguien que **no** tiene sesión de backoffice pero sí conoce
   * un `sesionId` real (la app se lo devuelve al alumno/invitado al
   * terminar de rendir).
   *
   * El backend NUNCA le manda la respuesta correcta a la tablet —
   * `TabletService.serializarPregunta()` la omite a propósito— y eso es
   * justamente lo que impide que alguien se apruebe una certificación de
   * seguridad laboral con `curl`. Como la app le devuelve al alumno el
   * `sesionId` al terminar de rendir, un GET abierto acá le daría las
   * respuestas correctas de su propio examen recién desaprobado, y podría
   * reintentar sabiéndolas todas.
   *
   * No sacar este guard. Ver docs/decisiones/sesiones.md.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  detalle(@Param('id') id: string) {
    return this.sesiones.detalle(id);
  }
}
