import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

async function controllerCon(queryRaw: jest.Mock) {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
  }).compile();
  return module.get<HealthController>(HealthController);
}

describe('HealthController', () => {
  it('devuelve status ok y db ok cuando la base responde', async () => {
    const controller = await controllerCon(jest.fn().mockResolvedValue([{ '?column?': 1 }]));

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('sima-training-api');
    expect(result.db).toBe('ok');
  });

  it('marca db en error cuando la base no responde', async () => {
    const controller = await controllerCon(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await controller.check();

    expect(result.db).toBe('error');
  });

  // Es la decisión de diseño del endpoint, no un detalle: devolver 503 con la
  // base caída haría que el health check de Render marque el servicio como
  // caído y **reinicie el contenedor**, y reiniciar no arregla una base caída
  // — sólo agrega un ciclo de reinicios encima del incidente. El proceso está
  // vivo; lo que falta es una dependencia, y eso se informa en el body.
  it('NO lanza con la base caída: sigue respondiendo 200 con status ok', async () => {
    const controller = await controllerCon(jest.fn().mockRejectedValue(new Error('boom')));

    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      db: 'error',
    });
  });
});
