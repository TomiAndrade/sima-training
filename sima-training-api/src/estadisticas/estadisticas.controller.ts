import { Controller, Get } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';

// Lectura, sin JWT — mismo criterio que el resto de los GET del proyecto
// ("lecturas abiertas; escrituras protegidas", ver CLAUDE.md) y mismo
// precedente que ResumenController.
//
// Puede quedar abierto porque el payload NO expone `respuestaCorrecta` en
// ningún lado: la distribución dice cuántos eligieron cada opción y cuál era la
// buena, sin entregar el string de la correcta. Es lo que lo diferencia de
// GET /sesiones/:id, que sí la expone y por eso sí lleva guard.
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticas: EstadisticasService) {}

  @Get('sima-check')
  simaCheck() {
    return this.estadisticas.simaCheck();
  }
}
