# -*- coding: utf-8 -*-
"""Recortes (srcRect) que Excel aplica a cada imagen, por (fila, nombre)."""
import zipfile
from xml.etree import ElementTree as ET

NS = {'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}


def recortes(path):
    """{nombre_imagen: (l, t, r, b) en fraccion} del recorte MAS agresivo."""
    z = zipfile.ZipFile(path)
    salida = {}
    for nombre in z.namelist():
        if not (nombre.startswith('xl/drawings/drawing') and nombre.endswith('.xml')):
            continue
        rels_path = nombre.replace('drawings/', 'drawings/_rels/') + '.rels'
        try:
            rels = {e.get('Id'): e.get('Target').split('/')[-1]
                    for e in ET.fromstring(z.read(rels_path))}
        except KeyError:
            continue
        for pic in ET.fromstring(z.read(nombre)).iter('{%s}pic' % NS['xdr']):
            blip = pic.find('.//a:blip', NS)
            img = rels.get(blip.get('{%s}embed' % NS['r']))
            sr = pic.find('.//a:srcRect', NS)
            if sr is None:
                caja = (0.0, 0.0, 0.0, 0.0)
            else:
                caja = tuple(int(sr.get(k, 0)) / 100000 for k in ('l', 't', 'r', 'b'))
            # Nos quedamos con el recorte mas grande: si la misma imagen aparece
            # recortada en una pregunta y entera en otra, el recorte es el que
            # lleva informacion (ver image34 de Basico, que muestra un solo panel).
            if img not in salida or sum(caja) > sum(salida[img]):
                salida[img] = caja
    return salida
