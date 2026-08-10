import { Module } from '@nestjs/common';
import { SesionesService } from './sesiones.service';

// Dominio de la rendición de evaluaciones: Sesion (un intento) + Respuesta (una por
// pregunta contestada). Módulo nuevo y no un cambio transversal, que es la
// convención del proyecto para cada entidad que se agrega.
//
// Todavía SIN controller: los endpoints que consume la tablet son la Story 5 del
// sprint. Acá vive la lógica (corrección, umbral, reintentos) para que esa story sea
// sólo exponerla por HTTP.
//
// No importa AsignacionesModule aunque toque `asignaciones`: lo hace por Prisma
// directo, igual que ModulosService consulta `pregunta`. Evita el ciclo, porque
// AsignacionesService.modulosAprobados() consulta `sesion` en la dirección contraria.
@Module({
  providers: [SesionesService],
  exports: [SesionesService],
})
export class SesionesModule {}
