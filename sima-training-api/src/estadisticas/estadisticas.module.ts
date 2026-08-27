import { Module } from '@nestjs/common';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';

// Estadísticas de CONTENIDO de SIMA CHECK: qué preguntas se fallan, qué temas
// hay que reforzar y dónde.
//
// Módulo propio y no una ruta más de `resumen/`: los dos son agregadores, pero
// responden preguntas distintas ("¿cuánta de mi gente está habilitada?" vs
// "¿qué contenido está fallando?"). No importa ningún otro módulo — consume
// Prisma directo, igual que ResumenModule, porque los services de cada dominio
// son por-usuario y harían N+1.
@Module({
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
})
export class EstadisticasModule {}
