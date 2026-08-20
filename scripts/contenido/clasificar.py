# -*- coding: utf-8 -*-
"""Clasifica lo que devolvio parse.py en preguntas del modelo (TipoPregunta)."""
import json, sys
from collections import OrderedDict

VF = {'true': 'Verdadero', 'false': 'Falso',
      'verdadero': 'Verdadero', 'falso': 'Falso'}


def clasificar(preguntas, archivo):
    salida = []
    for q in preguntas:
        textos = q['opciones']
        verdes = q['verdes']
        imgs = q['imagenes']
        notas = []
        item = {'n': q['n'], 'texto': q['texto'], 'archivo': archivo, 'notas': notas}

        valores = [o['texto'] for o in textos]
        normal = {v.strip().lower() for v in valores}

        if textos and normal <= set(VF):
            item['tipo'] = 'VERDADERO_FALSO'
            item['opciones'] = ['Verdadero', 'Falso']
            correctas = [VF[o['texto'].strip().lower()] for o in textos if o['verde']]
            item['correcta'] = correctas[0] if correctas else None
            item['imagenes_enunciado'] = [i['img'] for i in imgs]
        elif textos and normal <= {'a', 'b'}:
            # Las dos imagenes cuelgan del mismo anchor; A es la de la izquierda.
            item['tipo'] = 'OPCIONES_IMAGEN'
            item['opciones'] = [i['img'] for i in imgs]
            letras = [o['texto'].strip().upper() for o in textos if o['verde']]
            idx = {'A': 0, 'B': 1}.get(letras[0]) if letras else None
            item['correcta'] = item['opciones'][idx] if idx is not None and idx < len(item['opciones']) else None
            item['imagenes_enunciado'] = []
            if len(imgs) != 2:
                notas.append(f'esperaba 2 imagenes A/B, hay {len(imgs)}')
        elif textos:
            item['tipo'] = 'OPCION_MULTIPLE'
            orden = sorted(textos, key=lambda o: (o['fila'], o['col']))
            item['opciones'] = [o['texto'] for o in orden]
            correctas = [o['texto'] for o in orden if o['verde']]
            item['correcta'] = correctas[0] if correctas else None
            if len(correctas) > 1:
                notas.append('MAS DE UNA marcada verde: ' + ' / '.join(correctas))
            item['imagenes_enunciado'] = [i['img'] for i in imgs]
        elif imgs:
            # Opciones con imagen: una columna = una opcion; la correcta es la
            # columna donde hay una celda vacia pintada de verde.
            porcol = OrderedDict()
            for i in sorted(imgs, key=lambda i: (i['col'], i['fila'])):
                porcol.setdefault(i['col'], i['img'])
            item['tipo'] = 'OPCIONES_IMAGEN'
            item['opciones'] = list(porcol.values())
            cols_verdes = [c for _, c in verdes]
            item['correcta'] = porcol.get(cols_verdes[0]) if cols_verdes else None
            item['imagenes_enunciado'] = []
            if not cols_verdes:
                notas.append('SIN VERDE: correcta desconocida')
            elif item['correcta'] is None:
                notas.append(f'verde en columna {cols_verdes[0]}, sin imagen ahi')
        else:
            item['tipo'] = None
            notas.append('SIN OPCIONES')
            item['opciones'] = []
            item['correcta'] = None
            item['imagenes_enunciado'] = []

        if item['tipo'] and item['correcta'] is None and 'SIN VERDE' not in ''.join(notas):
            notas.append('SIN CORRECTA')
        if len(item.get('imagenes_enunciado', [])) > 2:
            notas.append(f"{len(item['imagenes_enunciado'])} imagenes de enunciado (decorativas?)")
        salida.append(item)
    return salida


if __name__ == '__main__':
    datos = json.load(open(sys.argv[1], encoding='utf8'))
    todo = {a: clasificar(qs, a) for a, qs in datos.items()}
    json.dump(todo, open(sys.argv[2], 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    for archivo, qs in todo.items():
        print('=' * 60)
        print(archivo)
        for q in qs:
            marca = '  !! ' if q['notas'] else '     '
            print(f"{marca}{q['n']:>3} [{q['tipo']}] {q['texto'][:70]!r}")
            print(f"          ops={q['opciones']} correcta={q['correcta']!r} img={q['imagenes_enunciado']}")
            for nota in q['notas']:
                print(f"          >>> {nota}")
