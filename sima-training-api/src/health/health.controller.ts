import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Estado del servicio. Chequea **también la base**: un health que sólo
   * responde "estoy vivo" sin tocar Postgres deja pasar el caso que más
   * importa —la API arriba y la base caída—, que es exactamente cuando todo
   * falla y nada lo avisa.
   *
   * **Siempre responde 200, incluso con la base caída**, y el detalle va en el
   * campo `db`. Es la distinción liveness / readiness: devolver 503 haría que
   * el health check de Render marque el servicio como caído y lo reinicie, y
   * reiniciar el contenedor **no arregla una base caída** — sólo agrega un
   * ciclo de reinicios encima del incidente. El proceso está vivo; lo que no
   * está disponible es una dependencia, y eso se informa, no se suicida.
   */
  @Get()
  async check() {
    return {
      status: 'ok',
      service: 'sima-training-api',
      db: await this.estadoDb(),
      timestamp: new Date().toISOString(),
    };
  }

  private async estadoDb(): Promise<'ok' | 'error'> {
    try {
      // `SELECT 1`: la consulta más barata que prueba que la conexión existe
      // y responde. No mira ninguna tabla — que el schema esté bien es cosa de
      // las migraciones, no de un health check.
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
