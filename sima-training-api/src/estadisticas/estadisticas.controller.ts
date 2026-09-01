import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { EstadisticasService } from './estadisticas.service';
import { InvitadosService } from './invitados.service';

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
  constructor(
    private readonly estadisticas: EstadisticasService,
    private readonly invitados: InvitadosService,
  ) {}

  @Get('sima-check')
  @Public()
  simaCheck() {
    return this.estadisticas.simaCheck();
  }

  // Cómo le fue al modo invitado. Endpoint SEPARADO y no un bloque más de
  // `sima-check`: son dos reportes con dos poblaciones distintas, y meterlos en
  // un payload invitaría justo a lo que las tablas separadas evitan — que
  // alguien sume los dos totales creyendo que hablan de la misma gente.
  //
  // @Public() con el mismo criterio que el resto: expone nombres y scores, que
  // es exactamente lo que ya expone `GET /resumen/sima-check` en `recientes`.
  // Ojo si algún día se le pide login al backoffice entero: éste es el endpoint
  // con datos de gente EXTERNA a la empresa, así que es el primero que
  // convendría cerrar.
  @Get('invitados')
  @Public()
  invitadosDemo() {
    return this.invitados.estadisticas();
  }
}
