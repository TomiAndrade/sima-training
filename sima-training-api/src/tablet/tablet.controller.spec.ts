import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { RegistrarSesionTabletDto } from './dto/registrar-sesion-tablet.dto';
import { TabletAuthGuard } from './tablet-auth.guard';
import { TabletController } from './tablet.controller';
import { TabletService } from './tablet.service';

describe('TabletController.rendir', () => {
  let controller: TabletController;
  let tablet: { rendir: jest.Mock };

  // `@Res({ passthrough: true })`: el controller llama `res.status(...)` y
  // devuelve el body normal — no hace falta más que espiar `status`.
  const buildRes = () => {
    const res = { status: jest.fn() } as unknown as Response & {
      status: jest.Mock;
    };
    res.status.mockReturnValue(res);
    return res;
  };

  const dto: RegistrarSesionTabletDto = {
    moduloVersionId: 'v1',
    finalizadaEn: new Date('2026-08-10T12:00:00Z'),
    respuestas: [{ preguntaId: 'p1', respuestaDada: 'V' }],
  } as RegistrarSesionTabletDto;

  const resultado = {
    sesionId: 's1',
    correctas: 3,
    total: 3,
    porcentaje: 100,
    aprobada: true,
    umbralAprobacion: 70,
  };

  beforeEach(async () => {
    tablet = { rendir: jest.fn() };

    // Se llama a controller.rendir() como función directa, sin pasar por
    // HTTP — el guard nunca corre. Pero @UseGuards(TabletAuthGuard) hace que
    // Nest intente resolver TabletAuthGuard (y su JwtService) al compilar el
    // módulo de test, así que se sobreescribe por un guard trivial.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TabletController],
      providers: [{ provide: TabletService, useValue: tablet }],
    })
      .overrideGuard(TabletAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(TabletController);
  });

  it('responde 201 cuando el service creó una sesión nueva', async () => {
    tablet.rendir.mockResolvedValue({ duplicada: false, resultado });
    const res = buildRes();

    const body = await controller.rendir(7, dto, res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    expect(body).toEqual(resultado);
  });

  it('responde 200 cuando el service deduplicó por claveIdempotencia', async () => {
    tablet.rendir.mockResolvedValue({ duplicada: true, resultado });
    const res = buildRes();

    const body = await controller.rendir(7, dto, res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    // El body es EXACTAMENTE el mismo en los dos casos — `duplicada` decide
    // sólo el status, no se filtra al JSON que ve la tablet.
    expect(body).toEqual(resultado);
  });

  it('usa el usuarioId que llega del token (decorator), no uno que pudiera venir en el dto', async () => {
    tablet.rendir.mockResolvedValue({ duplicada: false, resultado });

    await controller.rendir(7, dto, buildRes());

    expect(tablet.rendir).toHaveBeenCalledWith(7, dto);
  });
});

// La otra mitad de la garantía "el usuarioId sale del token, nunca del body":
// que un usuarioId colado en el JSON ni siquiera llegue al controller. Mismo
// mecanismo y misma técnica que el describe equivalente de
// sesiones/sesiones.service.spec.ts — acá con RegistrarSesionTabletDto, que
// es RegistrarSesionDto SIN usuarioId (ver el DTO).
describe('RegistrarSesionTabletDto contra la ValidationPipe de main.ts', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata = {
    type: 'body' as const,
    metatype: RegistrarSesionTabletDto,
  };
  const valido = {
    moduloVersionId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    finalizadaEn: '2026-08-10T12:00:00.000Z',
    respuestas: [
      { preguntaId: '3fa85f64-5717-4562-b3fc-2c963f66afa7', respuestaDada: 'V' },
    ],
  };

  it('acepta el body sin usuarioId', async () => {
    const salida = (await pipe.transform(
      valido,
      metadata,
    )) as RegistrarSesionTabletDto;
    expect(salida.finalizadaEn).toBeInstanceOf(Date);
  });

  it('RECHAZA (400) un body que trae usuarioId — no lo pisa en silencio', async () => {
    let rechazo: unknown;
    try {
      await pipe.transform({ ...valido, usuarioId: 999 }, metadata);
    } catch (err) {
      rechazo = err;
    }
    const respuesta = (rechazo as { getResponse: () => unknown }).getResponse();
    const mensajes = (respuesta as { message: string | string[] }).message;
    const lista = Array.isArray(mensajes) ? mensajes : [String(mensajes)];
    expect(lista).toContain('property usuarioId should not exist');
  });
});
