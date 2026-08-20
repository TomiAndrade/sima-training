// Carga el catálogo semilla de la demo: los puestos y centros de costo que ya
// tienen que existir cuando arranca la presentación.
//
//   npx ts-node scripts/demo/sembrar-catalogo.ts
//
// Existe porque HOY NO HAY IMPORT DE PUESTOS: el catálogo se carga a mano, una
// fila a la vez desde el backoffice (ver docs/pendientes.md). Cargar 16 puestos
// clickeando antes de cada demo no tiene sentido, así que esto lo suple — no es
// una feature, es preparación. El día que exista `POST /import/puestos` este
// script sobra.
//
// Reusa los services de Nest en vez de escribir con Prisma directo, mismo
// criterio que `sembrarSimaCheck()`: un insert crudo se saltea las validaciones que
// viven en el service (acá, la unicidad de nombre).
//
// Es idempotente: los que ya existen se saltean. Nada se borra — el catálogo es
// nómina, no fixture, y `limpiar()` del seed tampoco lo toca.

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { CentrosCostoService } from '../../src/centros-costo/centros-costo.service';
import { PuestosService } from '../../src/puestos/puestos.service';
import { CENTROS_SEMILLA, PUESTOS_SEMILLA } from './catalogo-demo';

// Mismo contrato que `resolverCatalogo` de prisma/seed.ts: los dos services
// exponen findAll()/create() con esta forma.
interface CatalogoService {
  findAll: () => Promise<{ id: string; nombre: string }[]>;
  create: (dto: { nombre: string }) => Promise<{ id: string; nombre: string }>;
}

async function sembrar(
  service: CatalogoService,
  nombres: string[],
  etiqueta: string,
) {
  const existentes = new Set((await service.findAll()).map((x) => x.nombre));
  let creados = 0;

  for (const nombre of nombres) {
    if (existentes.has(nombre)) {
      console.log(`  = ${nombre}  (ya existía)`);
      continue;
    }
    await service.create({ nombre });
    creados++;
    console.log(`  + ${nombre}`);
  }

  console.log(
    `${etiqueta}: ${creados} creados, ${nombres.length - creados} ya estaban.\n`,
  );
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    console.log('Puestos');
    await sembrar(app.get(PuestosService), PUESTOS_SEMILLA, 'Puestos');

    console.log('Centros de costo');
    await sembrar(app.get(CentrosCostoService), CENTROS_SEMILLA, 'Centros de costo');

    console.log('Catálogo semilla listo.');
    console.log(
      'En la demo conviene igual dar de alta 2-3 puestos a mano desde la pantalla',
    );
    console.log('Puestos, para mostrar el ABM antes de pasar al import.');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
