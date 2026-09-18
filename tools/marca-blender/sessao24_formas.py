"""
Sessão 24: o repertório com as regras abertas pelo fundador — curvas, inclinação,
uma cor, qualquer número de peças, e o 3D como método (modelar, rodar, ficar
com a silhueta plana).

    python3 -B tools/marca-blender/sessao24_formas.py <pasta>

Grava <pasta>/formas-sessao-24.json, que o sessao24.py (Blender) lê, e
<pasta>/mascaras/<id>.png, as silhuetas em alta resolução para a semelhança.

Cada conceito desenha-se em unidades de desenho (y para baixo), como uma lista
de operações — polígonos a tinta ou a fundo, traços, faces de uma malha
projetada. A forma desenha-se numa tela de 1200 × 1200 (50 px por unidade da
grelha de 24), encaixada pela maior dimensão em 18 unidades e centrada em
(12, 12), como a área viva 3..21 das sessões anteriores; os contornos saem do
OpenCV (exterior e furos) e passam à grelha de 100 com y para cima, o formato
que o gerar.Folha.pousar recebe. Nada disto é alinhado à grelha: com curvas e
inclinação, a regra das coordenadas inteiras da 19b deixa de se aplicar às
arestas oblíquas.

Dependências da WSL (não da app): numpy, Pillow, OpenCV.
"""

import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True

GRELHA = 24
R = 50  # píxeis por unidade da grelha
LADO = GRELHA * R
VIVA = 18
RAIO_RECORTE = 11

# ---------------------------------------------------------------------------
# Geometria 2D, em unidades de desenho (y para baixo)
# ---------------------------------------------------------------------------


def arco(cx, cy, r, a0, a1, n=96):
    """Ângulos em graus, no sentido anti-horário visto no ecrã."""
    return [(cx + r * math.cos(math.radians(a)), cy - r * math.sin(math.radians(a))) for a in np.linspace(a0, a1, n)]


def setor(cx, cy, r0, r1, a0, a1):
    return arco(cx, cy, r1, a0, a1) + arco(cx, cy, r0, a1, a0)


def circulo(cx, cy, r, n=192):
    return arco(cx, cy, r, 0, 360, n)[:-1]


def ret_arred(x0, y0, x1, y1, r, raios=None):
    """Retângulo com cantos de raio r; `raios` = (sup-esq, sup-dir, inf-dir, inf-esq) sobrepõe-se a r."""
    ra = raios or (r, r, r, r)
    pontos = []
    for (cx, cy, a0), rr in zip(((x0, y0, 90), (x1, y0, 0), (x1, y1, 270), (x0, y1, 180)), ra):
        rr = min(rr, (x1 - x0) / 2, (y1 - y0) / 2)
        sx = 1 if cx == x0 else -1
        sy = 1 if cy == y0 else -1
        centro = (cx + sx * rr, cy + sy * rr)
        if rr <= 0:
            pontos.append((cx, cy))
        else:
            pontos += arco(centro[0], centro[1], rr, a0 + 90, a0, 16)
    return pontos


def estadio(cx, cy, w, h):
    """A pista de atletismo: dois semicírculos e duas retas (deitada se w > h)."""
    if w >= h:
        r = h / 2
        return arco(cx + w / 2 - r, cy, r, -90, 90) + arco(cx - w / 2 + r, cy, r, 90, 270)
    r = w / 2
    return arco(cx, cy - h / 2 + r, r, 0, 180) + arco(cx, cy + h / 2 - r, r, 180, 360)


def catmull(pontos, passos=40):
    p = [pontos[0]] + list(pontos) + [pontos[-1]]
    saida = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = (np.array(p[i + k - 1]) for k in range(4))
        for t in np.linspace(0, 1, passos, endpoint=False):
            saida.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t**3)))
    saida.append(tuple(pontos[-1]))
    return saida


def densificar(pontos, passo):
    saida = [pontos[0]]
    for a, b in zip(pontos, pontos[1:]):
        d = math.dist(a, b)
        n = max(1, int(math.ceil(d / passo)))
        saida += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(1, n + 1)]
    return saida


def rodar(pontos, graus, centro=(0, 0)):
    a = math.radians(graus)
    c, s = math.cos(a), math.sin(a)
    cx, cy = centro
    # graus positivos = anti-horário no ecrã (y para baixo)
    return [(cx + (x - cx) * c + (y - cy) * s, cy - (x - cx) * s + (y - cy) * c) for x, y in pontos]


def inclinar(pontos, graus, y_base):
    """Itálico: desliza para a direita o que está acima de y_base."""
    k = math.tan(math.radians(graus))
    return [(x + k * (y_base - y), y) for x, y in pontos]


# ---------------------------------------------------------------------------
# Operações
# ---------------------------------------------------------------------------


def tinta(pontos):
    return ("poligono", pontos, True)


def fundo(pontos):
    return ("poligono", pontos, False)


def traco(pontos, largura, pontas="redondas", cor=True):
    return ("traco", pontos, largura, pontas, cor)


def grupo(ops):
    """Operações desenhadas numa tela à parte e somadas à principal: um corte dentro do grupo não apaga o resto."""
    return ("grupo", ops)


def pontos_de(op):
    return [p for o in op[1] for p in pontos_de(o)] if op[0] == "grupo" else op[1]


def transformar(ops, f):
    saida = []
    for op in ops:
        if op[0] == "grupo":
            saida.append(("grupo", transformar(op[1], f)))
        elif op[0] == "poligono":
            saida.append(("poligono", f(op[1]), op[2]))
        else:
            saida.append(("traco", f(op[1]), *op[2:]))
    return saida


def desenhar(ops, escala, dx, dy, lado):
    tela = Image.new("L", (lado, lado), 0)
    d = ImageDraw.Draw(tela)

    def px(pts):
        return [(dx + x * escala, dy + y * escala) for x, y in pts]

    for op in ops:
        if op[0] == "grupo":
            sub = desenhar(op[1], escala, dx, dy, lado)
            tela.paste(255, mask=Image.fromarray((sub * 255).astype(np.uint8)))
            continue
        if op[0] == "poligono":
            d.polygon(px(op[1]), fill=255 if op[2] else 0)
            continue
        _, pts, largura, pontas, cor = op
        valor = 255 if cor else 0
        pts = px(densificar(pts, largura * 0.05))
        w = largura * escala / 2
        for i, (a, b) in enumerate(zip(pts, pts[1:])):
            vx, vy = b[0] - a[0], b[1] - a[1]
            n = math.hypot(vx, vy) or 1
            nx, ny = -vy / n * w, vx / n * w
            d.polygon([(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)], fill=valor)
        for i, (x, y) in enumerate(pts):
            if pontas == "retas" and i in (0, len(pts) - 1):
                continue
            d.ellipse([x - w, y - w, x + w, y + w], fill=valor)
    return np.asarray(tela) >= 128


def encaixar(ops):
    """Duas passagens: mede a caixa da tinta e volta a desenhar com a forma em 18 unidades, centrada."""
    ensaio_lado = 1600
    todos = [p for op in ops for p in pontos_de(op)]
    xs, ys = [p[0] for p in todos], [p[1] for p in todos]
    extensao = max(max(xs) - min(xs), max(ys) - min(ys)) or 1
    escala = ensaio_lado * 0.6 / extensao
    dx = ensaio_lado / 2 - (min(xs) + max(xs)) / 2 * escala
    dy = ensaio_lado / 2 - (min(ys) + max(ys)) / 2 * escala
    m = desenhar(ops, escala, dx, dy, ensaio_lado)
    lin, col = np.nonzero(m)
    x0, x1 = (col.min() - dx) / escala, (col.max() + 1 - dx) / escala
    y0, y1 = (lin.min() - dy) / escala, (lin.max() + 1 - dy) / escala
    final = VIVA * R / max(x1 - x0, y1 - y0)
    return desenhar(ops, final, LADO / 2 - (x0 + x1) / 2 * final, LADO / 2 - (y0 + y1) / 2 * final, LADO)


# ---------------------------------------------------------------------------
# 3D como método: malhas, rotação, projeção ortográfica, silhueta
# ---------------------------------------------------------------------------


def matriz(guinada=0, arfagem=0, rolamento=0):
    g, a, r = (math.radians(v) for v in (guinada, arfagem, rolamento))
    ry = np.array([[math.cos(g), 0, math.sin(g)], [0, 1, 0], [-math.sin(g), 0, math.cos(g)]])
    rx = np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])
    rz = np.array([[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]])
    return rz @ rx @ ry


def caixa3d(x0, x1, y0, y1, z0, z1):
    v = np.array([(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)], dtype=float)
    faces = [(0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)]
    return v, faces


def prisma(perfil, profundidade):
    """Um perfil 2D (x, y para cima) extrudido em z; tampas e lados."""
    n = len(perfil)
    v = np.array([(x, y, z) for z in (0, profundidade) for x, y in perfil], dtype=float)
    faces = [tuple(range(n)), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return v, faces


def projetar(malhas, m):
    """Cada face vira um polígono a tinta, visto de frente (y para cima -> y para baixo no ecrã)."""
    ops = []
    for v, faces in malhas:
        p = v @ m.T
        for f in faces:
            ops.append(tinta([(p[i, 0], -p[i, 1]) for i in f]))
    return ops


# ---------------------------------------------------------------------------
# Os conceitos
# ---------------------------------------------------------------------------


def le(variacao):
    """ℓ de volta: um traço só que sobe, dá a volta (a volta é a contraforma) e sai no pé."""
    largura, graus = variacao
    caminho = catmull([(0.2, 8.6), (2.6, 6.4), (4.6, 3.4), (5.0, 1.2), (4.1, 0.1), (3.0, 0.8), (2.8, 3.4), (2.9, 6.8), (3.8, 9.4), (5.8, 10.1), (7.6, 9.3)])
    return [traco(inclinar(caminho, graus, 10), largura)]


def bp(variacao):
    """b de pista: a haste e uma pista de atletismo como bojo; o relvado é a contraforma."""
    bojo, t = variacao
    if bojo == "pista":
        w, h = 11.0, 8.0
    else:
        w, h = 9.5, 9.5
    x0 = 0
    cx, cy = x0 + w / 2, 18 - h / 2
    ops = [tinta(estadio(cx, cy, w, h)), fundo(estadio(cx, cy, w - 2 * t, h - 2 * t))]
    ops.append(tinta(ret_arred(x0, 0, x0 + t, 18, t / 2, (t / 2, t / 2, 0, 0))))
    return ops


def lz(variacao):
    """A P2122 aberta: a haste (5 × 11) e o pé (17 × 5) com a junta de 2 reta ou em arco — o dorso do pé é a curva de uma pista —, em itálico."""
    junta, graus = variacao
    if junta == "reta":
        ops = [tinta(ret_arred(0, 0, 5, 11, 1)), tinta(ret_arred(0, 13, 17, 18, 1))]
    else:
        cx, cy, r = 8.5, 33.0, 20.0  # o dorso do pé sobe ao meio: y = 13 em x = 8,5
        fora = arco(cx, cy, 80, 0, 180, 64)
        pe = grupo([tinta(ret_arred(0, 11, 17, 18, 1)), fundo(arco(cx, cy, r, 0, 180) + fora[::-1])])
        haste = grupo([tinta(ret_arred(0, 0, 5, 16, 1)), fundo(arco(cx, cy, r + 2, 180, 0) + [(cx + r + 2, cy + 1), (cx - r - 2, cy + 1)])])
        ops = [pe, haste]
    return transformar(ops, lambda p: inclinar(p, graus, 18))


def cu(variacao):
    """A curva da pista: o L desenhado como a curva de uma pista, com uma ou duas pistas."""
    pistas, raio = variacao
    tamanho = 18
    if pistas == 1:
        t = 5
        r = raio * tamanho
        caminho = [(t / 2, 0)] + arco(t / 2 + r, tamanho - t / 2 - r, r, 180, 270, 48)[0:] + [(tamanho, tamanho - t / 2)]
        return [traco(caminho, t, "retas")]
    t, vao = 3, 1.8
    ops = []
    for k in range(2):
        e = t / 2 + k * (t + vao)
        r = raio * tamanho + (1 - k) * (t + vao)
        # a pista de fora (k = 0) tem o raio maior; as duas terminam na mesma linha
        caminho = [(e, 0)] + arco(e + r, tamanho - e - r, r, 180, 270, 48) + [(tamanho, tamanho - e)]
        ops.append(traco(caminho, t, "retas"))
    return ops


def ar(variacao):
    """Arco de tijolos: as aduelas de um arco, que são também a curva de uma pista."""
    aduelas, pernas = variacao
    r0, r1, junta = 5.0, 10.0, 0.9
    ops = []
    for k in range(aduelas):
        a0 = 180 * k / aduelas
        a1 = 180 * (k + 1) / aduelas
        ops.append(tinta(setor(0, 0, r0, r1, a0, a1)))
    for k in range(1, aduelas):
        a = 180 * k / aduelas
        ops.append(traco([(r0 * 0.8 * math.cos(math.radians(a)), -r0 * 0.8 * math.sin(math.radians(a))), (r1 * 1.2 * math.cos(math.radians(a)), -r1 * 1.2 * math.sin(math.radians(a)))], junta, "retas", cor=False))
    if pernas:
        ops.append(fundo([(-r1 - 1, -0.001), (r1 + 1, -0.001), (r1 + 1, junta), (-r1 - 1, junta)]))
        for x in (-r1, r0):
            ops.append(tinta([(x, junta), (x + r1 - r0, junta), (x + r1 - r0, 7), (x, 7)]))
    return ops


def tj(variacao):
    """Tijolo curvo: um tijolo dobrado numa volta, inteiro ou partido por uma junta."""
    varredura, pecas = variacao
    r0, r1 = 6.0, 11.0
    a0 = 90 - varredura / 2 + 30
    a1 = a0 + varredura
    ops = [tinta(setor(0, 0, r0, r1, a0, a1))]
    if pecas == 2:
        meio = (a0 + a1) / 2
        ops.append(traco([(r0 * 0.9 * math.cos(math.radians(meio)), -r0 * 0.9 * math.sin(math.radians(meio))), (r1 * 1.1 * math.cos(math.radians(meio)), -r1 * 1.1 * math.sin(math.radians(meio)))], 1.1, "retas", cor=False))
    return ops


def es(variacao):
    """Espaço negativo reaberto: o L é o vazio, num recipiente curvo (a volta vista de cima, ou um tijolo)."""
    recipiente, corte = variacao
    t = 2.2
    if recipiente == "disco":
        ops = [tinta(circulo(9, 9, 9))]
    else:
        ops = [tinta(ret_arred(0, 3, 18, 15, 4))]
    if corte == "aberto":
        # o L atravessa até à borda: duas peças
        ops.append(traco([(6.0, -1), (6.0, 11.0), (19, 11.0)], t, "retas", cor=False))
    else:
        # o L fechado lá dentro: uma peça com um furo em L
        topo = 3.2 if recipiente == "disco" else 5.6
        fim = 13.5 if recipiente == "disco" else 14.0
        ops.append(traco([(6.0, topo), (6.0, 11.0), (fim, 11.0)], t, "redondas", cor=False))
    return ops


def kb(variacao):
    """Kettlebell de tijolo: o corpo é um tijolo, a pega é um arco; o furo é o vão da pega."""
    pega, corpo = variacao
    ops = []
    if corpo == "tijolo":
        ops.append(tinta(ret_arred(0, 8, 16, 18, 2.5, (2.5, 2.5, 5, 5))))
    else:
        ops.append(tinta(circulo(8, 12.5, 6.8)))
    if pega == "arco":
        ops.append(tinta(setor(8, 8.4, 4.2, 6.9, -8, 188)))
        ops.append(tinta([(1.1, 8.4), (3.8, 8.4), (3.8, 10), (1.1, 10)]))
        ops.append(tinta([(12.2, 8.4), (14.9, 8.4), (14.9, 10), (12.2, 10)]))
    else:
        ops.append(tinta(estadio(8, 5.2, 13.5, 7.0)))
        ops.append(fundo(estadio(8, 5.6, 8.6, 3.0)))
    return ops


def so(variacao):
    """A passada: a pegada da sapatilha feita de dois tijolos — a sola e o calcanhar."""
    pegadas, forma = variacao

    def pegada(dx, dy, graus):
        if forma == "retos":
            sola = ret_arred(0, 0, 5.4, 6.4, 2.0)
            calcanhar = ret_arred(0.6, 7.3, 4.8, 10.6, 1.5)
        else:
            sola = catmull([(2.6, 0), (5.2, 1.2), (5.6, 3.8), (4.4, 6.4), (1.2, 6.4), (0, 3.6), (0.4, 1.0), (2.6, 0)], 16)
            calcanhar = [(x + 0.2, y) for x, y in estadio(2.5, 9.0, 4.0, 3.4)]
        return [tinta(rodar(p, graus, (2, 6))) for p in (sola, calcanhar)], (dx, dy)

    ops = []
    if pegadas == 1:
        partes, _ = pegada(0, 0, -14)
        ops += partes
    else:
        for dx, dy, graus in ((0, 3.5, -10), (6.2, 0, -10)):
            partes, _ = pegada(dx, dy, graus)
            ops += transformar(partes, lambda p, dx=dx, dy=dy: [(x + dx, y + dy) for x, y in p])
    return ops


def pe(variacao):
    """Partida escalonada: as pistas da curva, cada uma a começar mais à frente."""
    pistas, ponta = variacao
    t, vao = 2.6, 1.6
    ops = []
    for k in range(pistas):
        r = 6 + k * (t + vao)
        inicio = 90 - k * 14
        caminho = arco(0, 0, r, inicio, 0 - 0, 48)
        if ponta == "tijolos":
            ops.append(traco(caminho, t, "retas"))
            meio = inicio - (inicio - 0) * 0.45
            ops.append(traco([((r - t) * math.cos(math.radians(meio)), -(r - t) * math.sin(math.radians(meio))), ((r + t) * math.cos(math.radians(meio)), -(r + t) * math.sin(math.radians(meio)))], 0.9, "retas", cor=False))
        else:
            ops.append(traco(caminho, t, "retas"))
    return ops


def gi(variacao):
    """A volta torcida: uma fita com meia torção (Möbius), rodada, e só a silhueta."""
    vista, largura = variacao
    raio, n = 10.0, 160
    vertices = []
    for k in range(n + 1):
        u = 2 * math.pi * k / n
        for s in (-largura / 2, largura / 2):
            vertices.append(((raio + s * math.cos(u / 2)) * math.cos(u), (raio + s * math.cos(u / 2)) * math.sin(u), s * math.sin(u / 2)))
    v = np.array(vertices)
    faces = [(2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2) for k in range(n)]
    guinada, arfagem = vista
    return projetar([(v, faces)], matriz(guinada, arfagem, 0) @ np.array([[1, 0, 0], [0, 0, 1], [0, 1, 0]]))


def cn(variacao):
    """Cunhal em 3D: um L maciço (a esquina de uma parede), rodado; fica a silhueta."""
    rotacao, profundidade = variacao
    perfil = [(0, 0), (18, 0), (18, 5), (5, 5), (5, 18), (0, 18)]
    guinada, arfagem = rotacao
    return projetar([prisma(perfil, profundidade * 18)], matriz(guinada, arfagem, 0))


def pi(variacao):
    """Pilha em espiral: tijolos empilhados, cada um rodado sobre o de baixo — a volta a subir."""
    tijolos, passo = variacao
    malhas = []
    for k in range(tijolos):
        v, f = caixa3d(-6, 6, k * 4.0, k * 4.0 + 2.8, -3, 3)
        a = math.radians(passo * k)
        rot = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
        malhas.append((v @ rot.T, f))
    # a câmara baixa (10°): mais alta, as faces de cima tapam as juntas e a pilha vira um bloco
    return projetar(malhas, matriz(0, 10, 0))


def la(variacao):
    """Ronda 2 — ℓ de volta larga: a volta é a contraforma e tem de sobreviver a 24 px (≥ 4 unidades por dentro)."""
    largura, graus = variacao
    caminho = catmull([(0.5, 9.0), (3.0, 6.5), (5.6, 3.6), (6.4, 1.2), (5.0, -0.4), (2.9, 0.3), (2.2, 3.2), (2.6, 6.8), (3.8, 9.3), (5.8, 10.0), (7.8, 9.2)])
    return [traco(inclinar(caminho, graus, 10), largura)]


def bf(variacao):
    """Ronda 2 — b de pista de traço fino: a BP com o traço abaixo de 2,6."""
    return bp(variacao)


def cf(variacao):
    """Ronda 2 — a curva da pista de uma pista, fina, direita ou em itálico."""
    t, graus = variacao
    r = 0.4 * 18
    caminho = [(t / 2, 0)] + arco(t / 2 + r, 18 - t / 2 - r, r, 180, 270, 48) + [(18, 18 - t / 2)]
    return transformar([traco(caminho, t, "retas")], lambda p: inclinar(p, graus, 18))


CONCEITOS = [
    # (código, nome, categoria, o que usa das regras novas, função, eixo 1, eixo 2)
    ("LE", "ℓ de volta", "letra + metáfora", "curva, inclinação, peça única", le, ("traço", [1.35, 1.8]), ("inclinação", [0, 14])),
    ("BP", "b de pista", "letra + metáfora", "curva, peça única", bp, ("bojo", ["pista", "redondo"]), ("traço", [2.6, 3.4])),
    ("LZ", "a P2122 em itálico", "letra + metáfora", "inclinação, curva", lz, ("junta", ["reta", "arco"]), ("inclinação", [8, 16])),
    ("CN", "cunhal em 3D", "letra + metáfora", "silhueta de 3D, peça única", cn, ("rotação", [(28, 18), (42, 32)]), ("profundidade", [0.3, 0.6])),
    ("ES", "L no vazio", "espaço negativo / dupla leitura", "curva (reabre a entrada 2)", es, ("recipiente", ["disco", "tijolo"]), ("corte", ["aberto", "fechado"])),
    ("AR", "arco de tijolos", "espaço negativo / dupla leitura", "curva", ar, ("aduelas", [3, 5]), ("pernas", [False, True])),
    ("TJ", "tijolo curvo", "geométrica abstrata", "curva, inclinação", tj, ("varredura", [100, 160]), ("peças", [1, 2])),
    ("GI", "volta torcida", "geométrica abstrata", "silhueta de 3D, curva, peça única", gi, ("vista", [(30, 25), (60, 45)]), ("largura", [3.5, 6.0])),
    ("PI", "pilha em espiral", "geométrica abstrata", "silhueta de 3D, inclinação", pi, ("tijolos", [3, 4]), ("passo", [30, 60])),
    ("CU", "curva da pista", "símbolo icónico simplificado", "curva", cu, ("pistas", [1, 2]), ("raio", [0.25, 0.55])),
    ("KB", "kettlebell de tijolo", "símbolo icónico simplificado", "curva, peça única", kb, ("pega", ["arco", "pista"]), ("corpo", ["tijolo", "sino"])),
    ("SO", "passada", "símbolo icónico simplificado", "curva, inclinação", so, ("pegadas", [1, 2]), ("forma", ["retos", "curvos"])),
    ("PE", "partida escalonada", "símbolo icónico simplificado", "curva", pe, ("pistas", [2, 3]), ("ponta", ["lisa", "tijolos"])),
    # ronda 2, desenhada depois de ver a semelhança e os 24 px da ronda 1: a fronteira entre as duas réguas
    ("LA", "ℓ de volta larga", "letra + metáfora", "curva, inclinação, peça única", la, ("traço", [1.3, 1.6]), ("inclinação", [0, 12]), 2),
    ("BF", "b de pista fino", "letra + metáfora", "curva, peça única", bf, ("bojo", ["pista", "redondo"]), ("traço", [1.9, 2.2]), 2),
    ("CF", "curva da pista fina", "símbolo icónico simplificado", "curva, inclinação", cf, ("traço", [3.0, 3.8]), ("inclinação", [0, 10]), 2),
]


# ---------------------------------------------------------------------------
# Contornos, medidas em alta resolução
# ---------------------------------------------------------------------------


def bem_composta(mascara):
    """Tira as ligações só em diagonal (dois píxeis de tinta a tocar-se num canto), enchendo um dos vizinhos.

    Sem isto, um contorno passa duas vezes pelo mesmo vértice e o
    tessellate_polygon do Blender enche mal a peça (na primeira corrida
    saíram assim a LE12, a KB12 e a PI21). A mudança é de 1/50 de unidade.
    """
    m = mascara.copy()
    while True:
        a, b, c, d = m[:-1, :-1], m[:-1, 1:], m[1:, :-1], m[1:, 1:]
        diag1 = a & d & ~b & ~c
        diag2 = b & c & ~a & ~d
        if not diag1.any() and not diag2.any():
            return m
        m[:-1, 1:] |= diag1
        m[:-1, :-1] |= diag2


def contornos(mascara):
    m = bem_composta(mascara).astype(np.uint8)
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    pecas = []
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1:
            continue
        grupo = [c] + [cs[j] for j in range(len(cs)) if hier[0][j][3] == i]
        convertidos = []
        for g in grupo:
            g = g.reshape(-1, 2)  # sem simplificar: a simplificação pode cruzar arestas nos traços finos
            if len(g) < 3:
                continue
            # o contorno do OpenCV passa pelo centro dos píxeis de fronteira: meio píxel para fora
            convertidos.append([((x + 0.5) / R * 100 / GRELHA, (GRELHA - (y + 0.5) / R) * 100 / GRELHA) for x, y in g])
        if convertidos:
            pecas.append({"tom": "B", "espessura": 0, "contornos": convertidos})
    return pecas


def contar(mascara):
    n_tinta, _ = cv2.connectedComponents(mascara.astype(np.uint8), connectivity=8)
    n_fundo, _ = cv2.connectedComponents((~mascara).astype(np.uint8), connectivity=4)
    # o rótulo 0 é o que não é fundo; um dos restantes é o fundo de fora
    return n_tinta - 1, n_fundo - 2


def perda_no_circulo(mascara):
    c = (np.arange(LADO) + 0.5) / R
    x, y = np.meshgrid(c, c)
    fora = (x - 12) ** 2 + (y - 12) ** 2 > RAIO_RECORTE**2
    return float((mascara & fora).sum() / mascara.sum())


def variantes():
    saida = []
    for codigo, nome, categoria, novas, funcao, (e1, v1), (e2, v2), *ronda in CONCEITOS:
        for i, a in enumerate(v1, 1):
            for j, b in enumerate(v2, 1):
                ident = f"{codigo}{i}{j}"
                mascara = bem_composta(encaixar(funcao((a, b))))
                pecas, furos = contar(mascara)
                # o que a variante usa de facto: sem inclinação a 0°, e a LZ de junta reta não tem curva
                usadas = [u.strip() for u in novas.split(",")]
                if (e1 == "inclinação" and a == 0) or (e2 == "inclinação" and b == 0):
                    usadas.remove("inclinação")
                if codigo == "LZ" and a == "reta":
                    usadas.remove("curva")
                saida.append(
                    {
                        "id": ident,
                        "familia": codigo,
                        "nome": f"{nome} · {e1} {a} · {e2} {b}",
                        "conceito": nome,
                        "categoria": categoria,
                        "novas": ", ".join(usadas),
                        "ronda": ronda[0] if ronda else 1,
                        "pecas_n": pecas,
                        "furos_n": furos,
                        "mascara": mascara,
                    }
                )
    return saida


def p2122_mascara():
    """A âncora, desenhada da mesma forma (ligadura.p2122 é a da cadeia)."""
    import ligadura

    v = ligadura.p2122()
    tela = Image.new("L", (LADO, LADO), 0)
    d = ImageDraw.Draw(tela)
    for peca in v["pecas"]:
        pts = lambda c: [(x * GRELHA / 100 * R, (100 - y) * GRELHA / 100 * R) for x, y in c]  # noqa: E731
        d.polygon(pts(peca["contornos"][0]), fill=255)
        for furo in peca["contornos"][1:]:
            d.polygon(pts(furo), fill=0)
    return v, np.asarray(tela) >= 128


def main():
    pasta = sys.argv[1]
    os.makedirs(os.path.join(pasta, "mascaras"), exist_ok=True)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    lista = []
    for v in variantes():
        mascara = bem_composta(v.pop("mascara"))
        Image.fromarray((mascara * 255).astype(np.uint8)).save(os.path.join(pasta, "mascaras", f"{v['id']}.png"), optimize=True)
        v.update({"pecas": contornos(mascara), "largura": 100.0, "altura": 100.0, "contraformas": [], "traco": None, "recorte": {"perda": perda_no_circulo(mascara)}})
        lista.append(v)
        print(f"{v['id']:5} peças {v['pecas_n']}  furos {v['furos_n']}  recorte {v['recorte']['perda'] * 100:5.1f} %  {v['nome']}")
    ancora, mascara = p2122_mascara()
    Image.fromarray((mascara * 255).astype(np.uint8)).save(os.path.join(pasta, "mascaras", "P2122.png"), optimize=True)
    print(f"P2122 recorte (forma inteira) {perda_no_circulo(mascara) * 100:.1f} %")
    with open(os.path.join(pasta, "formas-sessao-24.json"), "w", encoding="utf-8") as f:
        json.dump({"p2122_perda_forma": perda_no_circulo(mascara), "variantes": lista}, f, ensure_ascii=False)


if __name__ == "__main__":
    main()
