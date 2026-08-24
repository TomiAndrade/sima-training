import { Module } from '@nestjs/common';
import { SesionesController } from './sesiones.controller';
import { SesionesService } from './sesiones.service';

// Dominio de la rendición de evaluaciones: Sesion (un intento) + Respuesta (una por
// pregunta contestada). Módulo nuevo y no un cambio transversal, que es la
// convención del proyecto para cada entidad que se agrega.
//
// El controller tiene UN SOLO endpoint (GET /sesiones/:id, el detalle de un intento
// para el backoffice) y es el único con guard de todo el proyecto — ver el comentario
// largo en sesiones.controller.ts. Todo lo que consume la TABLET sigue viviendo en
// tablet/, que delega acá en vez de reimplementar la corrección y la idempotencia.
//
// No importa AsignacionesModule aunque toque `asignaciones`: lo hace por Prisma
// directo, igual que ModulosService consulta `pregunta`. Evita el ciclo, porque
// AsignacionesService.modulosAprobados() consulta `sesion` en la dirección contraria.
@Module({
  controllers: [SesionesController],
  providers: [SesionesService],
  exports: [SesionesService],
})
export class SesionesModule {}
