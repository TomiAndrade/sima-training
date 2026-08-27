import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SesionesService } from './sesiones.service';

@Controller('sesiones')
export class SesionesController {
  constructor(private readonly sesiones: SesionesService) {}

  /**
   * El detalle de UN intento: qué se preguntó, qué contestó la persona, si
   * estuvo bien y cuál era la correcta. Lo consume "Ver intento" en la hoja de
   * vida del backoffice.
   *
   * ⚠️ **ES LA ÚNICA LECTURA DEL PROYECTO CON GUARD, y no es un descuido.**
   * La convención es "lecturas abiertas; escrituras protegidas", pero éste es
   * el único GET que devuelve `Pregunta.respuestaCorrecta`.
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
  detalle(@Param('id') id: string) {
    return this.sesiones.detalle(id);
  }
}
