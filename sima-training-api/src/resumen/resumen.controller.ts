import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ResumenService } from './resumen.service';

// Lectura, sin JWT — mismo criterio que el resto de los GET del proyecto
// ("lecturas abiertas; escrituras protegidas", ver CLAUDE.md). No expone
// ningún dato por persona: son conteos agregados, salvo "Últimas evaluaciones",
// que muestra nombre y score de las 7 más recientes — lo mismo que ya se ve
// entrando a la hoja de vida de esa persona.
@Controller('resumen')
export class ResumenController {
  constructor(private readonly resumen: ResumenService) {}

  @Get('sima-check')
  @Public()
  simaCheck() {
    return this.resumen.simaCheck();
  }
}
