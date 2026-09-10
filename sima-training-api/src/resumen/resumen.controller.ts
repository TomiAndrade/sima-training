import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LECTURA_BACKOFFICE } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { ResumenService } from './resumen.service';

// Agregados de la pantalla Resumen del backoffice. No expone ningún dato
// por persona salvo "Últimas evaluaciones" (nombre y score de las 7 más
// recientes) — sensible de la misma forma que GET /usuarios, por eso
// requiere sesión de backoffice como el resto de las lecturas.
@Controller('resumen')
export class ResumenController {
  constructor(private readonly resumen: ResumenService) {}

  @Get('sima-check')
  @UseGuards(JwtAuthGuard)
  @Roles(...LECTURA_BACKOFFICE)
  simaCheck() {
    return this.resumen.simaCheck();
  }
}
