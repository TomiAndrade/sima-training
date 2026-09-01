import { Module } from '@nestjs/common';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';
import { InvitadosService } from './invitados.service';

// Estadísticas de CONTENIDO de SIMA CHECK: qué preguntas se fallan, qué temas
// hay que reforzar y dónde.
//
// Módulo propio y no una ruta más de `resumen/`: los dos son agregadores, pero
// responden preguntas distintas ("¿cuánta de mi gente está habilitada?" vs
// "¿qué contenido está fallando?"). No importa ningún otro módulo — consume
// Prisma directo, igual que ResumenModule, porque los services de cada dominio
// son por-usuario y harían N+1.
// InvitadosService cuelga de acá y no de `tablet/` (que es donde se ESCRIBEN las
// SesionInvitado) por la misma división que separa a los otros dos agregadores
// de sus dominios: `tablet/` sirve la app, `estadisticas/` responde preguntas
// sobre lo acumulado. Son dos services independientes que no comparten una sola
// query — ver el comentario de InvitadosService.
@Module({
  controllers: [EstadisticasController],
  providers: [EstadisticasService, InvitadosService],
})
export class EstadisticasModule {}
