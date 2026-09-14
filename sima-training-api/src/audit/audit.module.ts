import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

// Registro de auditoría. `AuditService` se exporta para que cada dominio que
// audita (Usuarios, Organizaciones, Preguntas, Módulos, ReglaAsignacion) lo
// inyecte y llame `registrar()` dentro de su propia transacción — este
// módulo no importa nada de esos dominios, la relación es al revés.
// `AuditController` es sólo el log GLOBAL (GET /audit-log); el historial por
// persona sigue colgando de `UsuariosController`.
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
