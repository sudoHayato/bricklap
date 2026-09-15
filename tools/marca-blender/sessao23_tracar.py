"""Vetoriza os controlos do Canva (PNG opaco sobre creme) para a grelha de 24, na área viva 3..21.

A tinta separa-se do fundo pela distância de cor ao fundo dominante (o Canva não
exporta transparente no plano gratuito). Contornos com o OpenCV, simplificados a
0,6 px na imagem de 1024; o maior lado da forma passa a medir 18 unidades.

    python3 tools/marca-blender/sessao23_tracar.py canva/r2/b1.png canva/r5/e4.png > tools/marca-blender/controlos-sessao-23.json
"""
import json
import sys
from collections import Counter

import cv2
import numpy as np
from PIL import Image

saida = []
for caminho in sys.argv[1:]:
    a = np.array(Image.open(caminho).convert("RGB")).astype(float)
    fundo = np.array(Counter(map(tuple, a.reshape(-1, 3).astype(int))).most_common(1)[0][0], dtype=float)
    distancia = np.linalg.norm(a - fundo, axis=2)
    mascara = (distancia > 60).astype(np.uint8)
    # só a maior região (tira pontos soltos e texto minúsculo)
    n, rotulos, estat, _ = cv2.connectedComponentsWithStats(mascara, 8)
    maior = 1 + int(np.argmax(estat[1:, cv2.CC_STAT_AREA]))
    mascara = (rotulos == maior).astype(np.uint8)
    contornos, hierarquia = cv2.findContours(mascara, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    x, y, w, h = cv2.boundingRect(mascara)
    escala = 18 / max(w, h)
    ox = 12 - w * escala / 2
    oy = 12 - h * escala / 2

    def para_grelha(c):
        c = cv2.approxPolyDP(c, 0.6, True).reshape(-1, 2)
        return [(ox + (px - x) * escala, oy + (py - y) * escala) for px, py in c]

    pecas = []
    for i, c in enumerate(contornos):
        if hierarquia[0][i][3] != -1:
            continue
        furos = [para_grelha(contornos[j]) for j in range(len(contornos)) if hierarquia[0][j][3] == i]
        pecas.append([para_grelha(c)] + furos)
    nome = caminho.rsplit("/", 1)[-1].removesuffix(".png")
    saida.append({"id": nome, "pecas": pecas, "tinta": "#%02X%02X%02X" % tuple(int(v) for v in a[mascara == 1].mean(axis=0)), "area_mascara_px": int(mascara.sum())})
json.dump(saida, sys.stdout, indent=1)
