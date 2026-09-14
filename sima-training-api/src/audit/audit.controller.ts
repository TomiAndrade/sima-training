import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AUDITORIA } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from './audit.service';
import { FindAuditLogDto } from './dto/find-audit-log.dto';

// Log GLOBAL, transversal a todas las entidades — distinto de
// GET /usuarios/:id/audit-log (que cuelga de UsuariosController porque es el
// historial de UNA persona). Sólo ADMINISTRADOR y AUDITOR: ver AUDITORIA en
// matriz-permisos.ts.
@Controller('audit-log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @Roles(...AUDITORIA)
  findAll(@Query() query: FindAuditLogDto) {
    return this.audit.listarGlobal(query);
  }
}
