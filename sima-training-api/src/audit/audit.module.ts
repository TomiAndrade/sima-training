import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// Story 9, paso 2: registro de auditoría. Sin controller propio (no hay
// endpoint todavía) y sin importar otros módulos — sólo expone AuditService
// para que quien haga el cambio (UsuariosService, paso 3) lo llame dentro de
// su propia transacción. Registrar este módulo en AppModule y engancharlo es
// el paso 3, no éste.
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
