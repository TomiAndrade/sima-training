import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EstadisticasService } from './estadisticas.service';
import { InvitadosService } from './invitados.service';

// Agregados de la pantalla Estadísticas del backoffice — requiere sesión,
// mismo criterio que ResumenController.
//
// El payload de `sima-check` NO expone `respuestaCorrecta` en ningún lado (la
// distribución dice cuántos eligieron cada opción y cuál era la buena, sin
// entregar el string de la correcta) — es lo que lo diferencia de
// GET /sesiones/:id, que sí la expone. Eso nunca fue el motivo para dejarlo
// sin guard, sólo el motivo por el que no hacía falta el guard *extra* que
// tiene sesiones.controller.ts.
@Controller('estadisticas')
export class EstadisticasController {
  constructor(
    private readonly estadisticas: EstadisticasService,
    private readonly invitados: InvitadosService,
  ) {}

  @Get('sima-check')
  @UseGuards(JwtAuthGuard)
  simaCheck() {
    return this.estadisticas.simaCheck();
  }

  // Cómo le fue al modo invitado. Endpoint SEPARADO y no un bloque más de
  // `sima-check`: son dos reportes con dos poblaciones distintas, y meterlos en
  // un payload invitaría justo a lo que las tablas separadas evitan — que
  // alguien sume los dos totales creyendo que hablan de la misma gente.
  //
  // Expone nombres y scores de gente EXTERNA a la empresa (quien probó la demo
  // sin ser parte del sistema) — dato más sensible todavía que el resto, por
  // eso también requiere sesión de backoffice.
  @Get('invitados')
  @UseGuards(JwtAuthGuard)
  invitadosDemo() {
    return this.invitados.estadisticas();
  }
}
