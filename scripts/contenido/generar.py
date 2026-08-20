# -*- coding: utf-8 -*-
"""Genera prisma/seed-assets/preguntas/*.png y prisma/seed-data/preguntas-sima-check.ts
a partir de los 5 Excel de SIMA CHECK que estan en TRAINING/docs/.

Los Excel NO se versionan (llevan PII de nomina en el archivo hermano y el
.gitignore los bloquea), asi que este script es la trazabilidad de como se
genero el contenido: la salida SI se versiona.
"""
import hashlib, io, os, re, sys, zipfile
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse import parsear
from clasificar import clasificar
from geometria import recortes
# Alias: `CORRECCIONES` a secas ya es, en este archivo, el arreglo a mano de lo
# que el Excel deja AMBIGUO (una pregunta sin verde, otra con dos). Esto otro es
# ortografia y redaccion, que es otra cosa.
from correcciones import CORRECCIONES as CORRECCIONES_TEXTO
from correcciones import CORRECCIONES_POR_PREGUNTA

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS = os.path.join(RAIZ, 'docs')
DESTINO = os.path.join(RAIZ, 'sima-training-api', 'prisma')
MAX_LADO = 800

MODULOS = [
    ('basico', 'SIMA - Básico.xlsx'),
    ('intermedio', 'SIMA - Intermedio.xlsx'),
    ('avanzado', 'SIMA - Avanzado (1).xlsx'),
    ('reglas-oro', 'Sima Check - Reglas de Oro Industria Petrolera.xlsx'),
    ('phoenix', 'Sima Check - Módulo Phoenix.xlsx'),
]

# Arreglos a mano de lo que el Excel deja ambiguo. Cada uno esta justificado en
# docs/decisiones/ y anotado en el resumen que imprime el script.
CORRECCIONES = {
    # El enunciado trae la tira de los 10 pictogramas de todas las reglas: es
    # decoracion de portada, no la imagen de ESTA pregunta.
    ('reglas-oro', 1): {'imagenes_enunciado': []},
    # Dos imagenes (altura + excavacion) y DOS opciones pintadas de verde. Se
    # deja la de trabajo en altura, que es la que matchea la primera verde.
    ('reglas-oro', 4): {'imagenes_enunciado': ['image12.png'],
                        'correcta': 'Trabajo en altura'},
    # Unica pregunta con opciones de imagen SIN verde en el Excel. El tacho azul
    # es el de metales en el mismo codigo de colores que usan las preguntas 10 a
    # 13 (amarillo plastico, verde biodegradable, blanco vidrio, rojo
    # hidrocarburos), y es el unico de los tres que no quedo tomado.
    ('phoenix', 14): {'correcta': 'image14.png'},
}


def normalizar_texto(texto):
    texto = re.sub(r'\s*"A"\s*o\s*"B"\s*$', '', texto).strip()
    return re.sub(r'[ \t]+', ' ', texto).strip()


# Claves de CORRECCIONES_TEXTO que llegaron a usarse. Lo que quede afuera es una
# clave mal tipeada --no matchea nada y la correccion se pierde en silencio--, y
# main() aborta si pasa.
_usadas = set()


def corregir(cadena, slug, numero):
    """Aplica las correcciones de redaccion a UNA cadena.

    Se llama igual para el enunciado, para cada opcion y para la respuesta
    correcta. Que sea la misma funcion con el mismo mapa es lo que garantiza
    que una opcion y la respuesta correcta no se desincronicen (ver la cabecera
    de correcciones.py).
    """
    por_pregunta = CORRECCIONES_POR_PREGUNTA.get((slug, numero), {})
    if cadena in por_pregunta:
        return por_pregunta[cadena]
    if cadena in CORRECCIONES_TEXTO:
        _usadas.add(cadena)
        return CORRECCIONES_TEXTO[cadena]
    return cadena


class Assets:
    """Escribe las imagenes deduplicadas por contenido."""

    def __init__(self, carpeta):
        self.carpeta = carpeta
        self.por_hash = {}
        os.makedirs(carpeta, exist_ok=True)

    def guardar(self, imagen, nombre_base, formato):
        # Una foto guardada como PNG pesa 5-10x lo mismo en JPEG. Se pasa a
        # JPEG solo si el alfa es 100% opaco: los pictogramas tienen fondo
        # transparente y ahi el PNG no se negocia.
        if formato == 'PNG' and imagen.mode == 'RGBA':
            alfa = imagen.getchannel('A')
            if alfa.getextrema() == (255, 255):
                imagen, formato = imagen.convert('RGB'), 'JPEG'
        buf = io.BytesIO()
        if formato == 'JPEG':
            imagen.save(buf, format='JPEG', quality=85, optimize=True)
        else:
            imagen.save(buf, format='PNG', optimize=True)
        datos = buf.getvalue()
        h = hashlib.sha1(datos).hexdigest()
        if h in self.por_hash:
            return self.por_hash[h]
        nombre = f'{nombre_base}.{"jpg" if formato == "JPEG" else "png"}'
        with open(os.path.join(self.carpeta, nombre), 'wb') as fh:
            fh.write(datos)
        self.por_hash[h] = nombre
        return nombre


def abrir(zf, nombre, caja):
    im = Image.open(io.BytesIO(zf.read('xl/media/' + nombre)))
    formato = 'JPEG' if im.format == 'JPEG' else 'PNG'
    im = im.convert('RGB' if formato == 'JPEG' else 'RGBA')
    l, t, r, b = caja
    if sum(caja) > 0.01:
        w, h = im.size
        im = im.crop((int(w * l), int(h * t), int(w * (1 - r)), int(h * (1 - b))))
    im.thumbnail((MAX_LADO, MAX_LADO))
    return im, formato


def componer(imagenes):
    """Pega N imagenes lado a lado con la misma altura y fondo blanco."""
    alto = max(im.height for im in imagenes)
    escaladas = [im.resize((int(im.width * alto / im.height), alto)) for im in imagenes]
    sep = 24
    lienzo = Image.new('RGBA', (sum(im.width for im in escaladas) + sep * (len(escaladas) - 1), alto),
                       (255, 255, 255, 255))
    x = 0
    for im in escaladas:
        lienzo.paste(im, (x, 0), im if im.mode == 'RGBA' else None)
        x += im.width + sep
    lienzo.thumbnail((MAX_LADO, MAX_LADO))
    return lienzo


CABECERA = """// ARCHIVO GENERADO — no editar a mano.
//
// Sale de los cinco Excel de evaluación que usa SIMA CHECK en papel
// (`docs/SIMA - Básico.xlsx`, `- Intermedio`, `- Avanzado`,
// `docs/Sima Check - Reglas de Oro Industria Petrolera.xlsx` y
// `- Módulo Phoenix.xlsx`). En esos Excel la respuesta correcta está PINTADA DE
// VERDE: en la celda con el texto cuando la opción es texto, y en la celda vacía
// que queda debajo de la imagen cuando la opción es una imagen.
//
// Los Excel NO están versionados —el .gitignore los bloquea porque el archivo
// hermano de nómina lleva PII— así que este archivo y las imágenes de
// `seed-assets/preguntas/` son la única copia versionada del contenido. Se
// regenera con `python scripts/contenido/generar.py`, que necesita los Excel en
// `docs/`; el porqué de cada convención (incluidos los tres casos que el Excel
// deja ambiguos) está en `docs/decisiones/preguntas.md`, sección "El contenido
// real: los cinco Excel de SIMA CHECK".
//
// Las imágenes se referencian por NOMBRE DE ARCHIVO dentro de
// `prisma/seed-assets/preguntas/`. El seed las sube por StorageService y
// reemplaza cada nombre por la clave opaca que devuelve, que es lo que termina
// en la base — acá no hay claves de storage ni rutas.

import { TipoPregunta } from '@prisma/client';

export interface PreguntaSeed {
  texto: string;
  tipo: TipoPregunta;
  // OPCION_MULTIPLE: los textos tal cual se muestran.
  // OPCIONES_IMAGEN: nombres de archivo de seed-assets/preguntas/.
  // VERDADERO_FALSO: ausente — las dos opciones las pone el frontend.
  opciones?: string[];
  // Mismo vocabulario que `opciones`: un texto, 'Verdadero'/'Falso', o el
  // nombre de archivo de la imagen correcta.
  respuestaCorrecta: string;
  // Imagen del enunciado (nombre de archivo), si la pregunta la tiene.
  imagen?: string;
}

"""


def lit(texto):
    """String literal de TS en comillas simples (prettier: singleQuote)."""
    return "'" + texto.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"


def emitir_ts(salida):
    lineas = [CABECERA, 'export const PREGUNTAS: Record<string, PreguntaSeed[]> = {']
    for slug, preguntas in salida.items():
        lineas.append(f"  '{slug}': [")
        for q in preguntas:
            lineas.append('    {')
            lineas.append(f"      texto: {lit(q['texto'])},")
            lineas.append(f"      tipo: TipoPregunta.{q['tipo']},")
            if q.get('opciones'):
                lineas.append('      opciones: [')
                for o in q['opciones']:
                    lineas.append(f'        {lit(o)},')
                lineas.append('      ],')
            lineas.append(f"      respuestaCorrecta: {lit(q['respuestaCorrecta'])},")
            if q.get('imagen'):
                lineas.append(f"      imagen: {lit(q['imagen'])},")
            lineas.append('    },')
        lineas.append('  ],')
    lineas.append('};')
    lineas.append('')
    destino = os.path.join(DESTINO, 'seed-data')
    os.makedirs(destino, exist_ok=True)
    with open(os.path.join(destino, 'preguntas-sima-check.ts'), 'w', encoding='utf8', newline='\n') as fh:
        fh.write('\n'.join(lineas))


def main():
    assets = Assets(os.path.join(DESTINO, 'seed-assets', 'preguntas'))
    salida, avisos = {}, []

    for slug, archivo in MODULOS:
        ruta = os.path.join(DOCS, archivo)
        preguntas = clasificar(parsear(ruta), archivo)
        cajas = recortes(ruta)
        zf = zipfile.ZipFile(ruta)

        def asset(nombre_img):
            im, formato = abrir(zf, nombre_img, cajas.get(nombre_img, (0, 0, 0, 0)))
            base = f'{slug}-{os.path.splitext(nombre_img)[0]}'
            return assets.guardar(im, base, formato)

        lista = []
        # `numero` es la POSICION dentro del modulo (1-based), no el `n` que
        # trae el Excel: el Intermedio numera 1..24 y despues 31 dos veces, asi
        # que su `n` no sirve como clave. Es tambien el numero que se ve en el
        # backoffice y en la tablet.
        for numero, q in enumerate(preguntas, start=1):
            q.update(CORRECCIONES.get((slug, numero), {}))
            item = {
                'texto': corregir(normalizar_texto(q['texto']), slug, numero),
                'tipo': q['tipo'],
            }

            if q['tipo'] == 'OPCIONES_IMAGEN':
                # Acá las opciones son nombres de archivo, no texto: no se
                # corrigen (ningún key del mapa los matchea) y se resuelven a
                # su clave de storage.
                item['opciones'] = [asset(o) for o in q['opciones']]
                item['respuestaCorrecta'] = asset(q['correcta'])
            else:
                if q['tipo'] == 'OPCION_MULTIPLE':
                    item['opciones'] = [corregir(o, slug, numero) for o in q['opciones']]
                item['respuestaCorrecta'] = corregir(q['correcta'], slug, numero)

                # La correcta es UNA DE LAS OPCIONES, comparada por igualdad de
                # string. Si una corrección tocara la opción y no la respuesta
                # (o al revés), la pregunta quedaría sin ninguna correcta y
                # nadie podría aprobarla — y no se notaría hasta que alguien la
                # rinda. El backend lo valida también, pero acá se ve el
                # nombre del módulo y el número.
                if item.get('opciones') and item['respuestaCorrecta'] not in item['opciones']:
                    raise SystemExit(
                        f'{slug} #{numero}: tras corregir, la respuesta correcta '
                        f'{item["respuestaCorrecta"]!r} no está entre las opciones '
                        f'{item["opciones"]!r}'
                    )

            enunciado = q['imagenes_enunciado']
            if len(enunciado) == 1:
                item['imagen'] = asset(enunciado[0])
            elif len(enunciado) > 1:
                partes = [abrir(zf, n, cajas.get(n, (0, 0, 0, 0)))[0] for n in enunciado]
                item['imagen'] = assets.guardar(componer(partes), f'{slug}-{q["n"]:02d}-compuesta', 'PNG')
                avisos.append(f'{slug} #{q["n"]}: enunciado con {len(enunciado)} imagenes -> compuesta')

            if not item['respuestaCorrecta']:
                avisos.append(f'{slug} #{q["n"]}: SIN RESPUESTA CORRECTA')
            lista.append(item)
        salida[slug] = lista

    # Una clave que no matcheó nada es una clave mal tipeada, y su corrección se
    # perdería en silencio. Aborta antes de emitir.
    sin_usar = sorted(set(CORRECCIONES_TEXTO) - _usadas)
    if sin_usar:
        print(f'\n{len(sin_usar)} correcciones NO matchearon ningun texto:')
        for clave in sin_usar:
            print(f'  - {clave[:110]!r}')
        raise SystemExit('Revisá esas claves contra el texto real antes de regenerar.')

    emitir_ts(salida)
    total = sum(len(v) for v in salida.values())
    print(f'{total} preguntas, {len(set(assets.por_hash.values()))} imagenes')
    for slug, lista in salida.items():
        tipos = {}
        for q in lista:
            tipos[q['tipo']] = tipos.get(q['tipo'], 0) + 1
        print(f'  {slug:12} {len(lista):3}  {tipos}')
    for a in avisos:
        print('  !! ' + a)


if __name__ == '__main__':
    main()
