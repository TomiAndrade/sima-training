// Siembra las bases de conocimiento de la demo con su escala de niveles y su
// banco de preguntas (los datos están en banco-demo.ts).
//
//   npx ts-node scripts/demo/sembrar-contenido.ts
//
// NO crea módulos ni reglas: eso se hace EN VIVO durante la demo, que es
// justamente lo que se está mostrando. Esto deja listo el insumo — las
// preguntas clasificadas por tema y dificultad — para que crear el módulo sea
// elegir un criterio y ver cómo se llena solo.
//
// Reusa los services de Nest (mismo criterio que `sembrarSimaCheck()`): así corren
// `resolverFuente` (que copia la fuente de la base y la congela en cada
// pregunta) y el appendeo de `orden` de los niveles, en vez de saltearlos con
// inserts crudos.
//
// NO es idempotente: aborta si ya hay bases cargadas. Sembrar dos veces
// duplicaría el banco y el módulo de la demo terminaría con preguntas repetidas
// en el sorteo. La demo arranca de `prisma migrate reset --force`, así que la
// base siempre está limpia — y si no lo está, el mensaje lo dice.

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { BasesConocimientoService } from '../../src/bases-conocimiento/bases-conocimiento.service';
import { PreguntasService } from '../../src/preguntas/preguntas.service';
import { BASES_DEMO } from './banco-demo';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const bases = app.get(BasesConocimientoService);
    const preguntas = app.get(PreguntasService);

    const yaCargadas = await bases.findAll();
    if (yaCargadas.length > 0) {
      console.error(
        `Ya hay ${yaCargadas.length} base(s) de conocimiento cargadas: ${yaCargadas
          .map((b) => b.nombre)
          .join(', ')}.`,
      );
      console.error(
        'Este script no es idempotente — sembrar encima duplicaría el banco.',
      );
      console.error('Corré primero:  npx prisma migrate reset --force');
      process.exitCode = 1;
      return;
    }

    let totalPreguntas = 0;

    for (const baseDemo of BASES_DEMO) {
      const base = await bases.create({
        nombre: baseDemo.nombre,
        codigo: baseDemo.codigo,
        descripcion: baseDemo.descripcion,
        fuente: baseDemo.fuente,
      });
      console.log(`\n[${base.codigo}] ${base.nombre}`);

      for (const nivelDemo of baseDemo.niveles) {
        // Sin `orden` explícito: el service lo appendea (max + 1), así los
        // niveles quedan en el orden en que están escritos en banco-demo.ts.
        const nivel = await bases.crearNivel(base.id, { nombre: nivelDemo.nombre });

        // En serie y no en paralelo: `resolverFuente` consulta la base por cada
        // pregunta (mismo motivo que `crearPreguntas` del seed).
        for (const p of nivelDemo.preguntas) {
          await preguntas.create({
            texto: p.texto,
            tipo: p.tipo,
            ...(p.opciones ? { opciones: p.opciones } : {}),
            respuestaCorrecta: p.respuestaCorrecta,
            baseConocimientoId: base.id,
            nivelId: nivel.id,
          });
          totalPreguntas++;
        }

        console.log(
          `  nivel ${nivel.orden} ${nivelDemo.nombre.padEnd(12)} ${nivelDemo.preguntas.length} preguntas   ${nivel.id}`,
        );
      }
    }

    console.log(
      `\n${BASES_DEMO.length} bases · ${totalPreguntas} preguntas sembradas.`,
    );
    console.log(
      'El examen sortea 3 preguntas del pool que trae el criterio del módulo.',
    );
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
