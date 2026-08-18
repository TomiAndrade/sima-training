import { Module } from '@nestjs/common';
import { ResumenController } from './resumen.controller';
import { ResumenService } from './resumen.service';

// Módulo propio y no un endpoint colgado de `asignaciones/` o `sesiones/`:
// cruza los tres dominios (Asignacion + Sesion + Usuario) y no le pertenece a
// ninguno. Mismo criterio que hizo que el informe por persona viva en
// `usuarios/`: el agregador va donde está su sujeto, y acá el sujeto es la
// pantalla Resumen de SIMA CHECK, no una entidad.
//
// No importa AsignacionesModule ni SesionesModule: consume Prisma directo
// porque lo que necesita son agregados, no las operaciones de esos services
// (que son todas por-usuario y harían N+1). Lo que sí reusa son las funciones
// PURAS de vigencia y veredicto, que no dependen de Nest.
@Module({
  controllers: [ResumenController],
  providers: [ResumenService],
})
export class ResumenModule {}
