"""
Sessão 23: duas folhas fora do Blender — as 20 saídas do Canva com a leitura, e
as contraformas a 24 px ampliadas ×12 (vizinho mais próximo).

    python3 tools/marca-blender/sessao23_folhas.py <pasta-da-sessão>

A pasta tem canva/r1..r5/*.png (as exportações, fora do git) e medicao/ (a saída
do sessao23.sh); as duas folhas gravam-se nela.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

os.chdir(sys.argv[1])
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
fonte, negrito, pequena = ImageFont.truetype(F, 15), ImageFont.truetype(FB, 17), ImageFont.truetype(F, 13)

RONDAS = [
    ("r1", "a", "(a) traço contínuo que dobra, como o Strava", [
        ("a1", "B itálico em fonte — é texto, não forma"),
        ("a2", "etiqueta de preço com furo — ícone de interface"),
        ("a3", "L de letra, torto — só letra, nenhuma forma"),
        ("a4", "pentágono com furo — início / ejetar"),
    ]),
    ("r2", "b", "(b) blocos gordos em degrau diagonal, como o Replit", [
        ("b1", "escada numa silhueta só — gráfico a subir; família Y; sem letra"),
        ("b2", "tijolos em 3D — viola as restrições"),
        ("b3", "tijolos em 3D — viola as restrições"),
        ("b4", "vazio, só um «R» — falhou"),
    ]),
    ("r3", "c", "(c) um L que é também um tijolo", [
        ("c1", "cubo isométrico — 3D"),
        ("c2", "⅃ espelhado, sem diagonal — não é L"),
        ("c3", "quadrado arredondado com sombra — genérico"),
        ("c4", "cubo isométrico — 3D"),
    ]),
    ("r4", "d", "(d) uma volta de pista abstrata", [
        ("d1", "anéis fechados com linhas de pista — interruptor"),
        ("d2", "anel — indicador de carregamento"),
        ("d3", "quadrado vazado — a moldura (M)"),
        ("d4", "pastilha com linhas — interruptor"),
    ]),
    ("r5", "e", "(e) a minha: canto gordo inclinado, pedido curto", [
        ("e1", "retângulo com canto em degraus — cartão SD"),
        ("e2", "paralelogramo liso — genérico, sem letra"),
        ("e3", "duas folhas cor de laranja — duas peças, sem letra"),
        ("e4", "raio em Z — cliché de fitness; letra Z"),
    ]),
]


def folha_canva():
    t, m, cab, legenda = 220, 24, 70, 64
    largura = m * 2 + 4 * (t + 16)
    altura = cab + len(RONDAS) * (t + legenda + 40) + m
    folha = Image.new("RGB", (largura, altura), (255, 255, 255))
    d = ImageDraw.Draw(folha)
    d.text((m, 16), "Sessão 23 · Canva, 5 rondas, 20 designs · nenhum passou no juízo (leitura a 100 %)", font=negrito, fill=(22, 18, 15))
    d.text((m, 42), "Exportados opacos (o plano gratuito não exporta transparente). Cores pedidas: #C0402C sobre #FBF8F4 — nenhum as respeitou.", font=pequena, fill=(90, 82, 75))
    y = cab
    for pasta, _, titulo, itens in RONDAS:
        d.text((m, y), titulo, font=fonte, fill=(22, 18, 15))
        y += 24
        for k, (ident, leitura) in enumerate(itens):
            x = m + k * (t + 16)
            im = Image.open(f"canva/{pasta}/{ident}.png").convert("RGB").resize((t, t), Image.LANCZOS)
            folha.paste(im, (x, y))
            d.text((x, y + t + 4), ident, font=negrito, fill=(22, 18, 15))
            palavras, linha, linhas = leitura.split(), "", []
            for p in palavras:
                if d.textlength(linha + " " + p, font=pequena) > t:
                    linhas.append(linha)
                    linha = p
                else:
                    linha = (linha + " " + p).strip()
            linhas.append(linha)
            for j, l in enumerate(linhas[:3]):
                d.text((x, y + t + 24 + j * 15), l, font=pequena, fill=(90, 82, 75))
        y += t + legenda + 16
    folha.save("folha-canva-rondas.png")


def folha_contraformas():
    dados = json.load(open("medicao/caixas.json"))
    medidas = json.load(open("medicao/medidas.json"))
    img = np.array(Image.open("medicao/folha-24px.png").convert("RGB"))
    ids = ["P2122", "ANTES", "BL2q", "BL3q", "BL4q", "BL5q", "BL2r", "BL3r", "BL4r", "BL5r"]
    z, m, cab = 12, 24, 70
    passo = 24 * z + 40
    largura = m * 2 + 5 * passo
    altura = cab + 2 * 2 * (24 * z + 70) + m
    folha = Image.new("RGB", (largura, altura), (255, 255, 255))
    d = ImageDraw.Draw(folha)
    d.text((m, 16), "Sessão 23 · a ligadura BL a 24 px, ampliada ×12 píxel a píxel (vizinho mais próximo), #C0402C", font=negrito, fill=(22, 18, 15))
    d.text((m, 42), "Contorno verde: a contraforma na grelha. Número: píxeis limpos (≤ 25 % de tinta) / píxeis dentro dela.", font=pequena, fill=(90, 82, 75))
    y = cab
    for tema in ("creme", "escuro"):
        for fila in (ids[:5], ids[5:]):
            for k, ident in enumerate(fila):
                caixa = next(c for c in dados["folha-24px"] if c["id"] == ident and c["tema"] == tema and c.get("cor") == "marca")
                corte = img[caixa["y"] : caixa["y"] + 24, caixa["x"] : caixa["x"] + 24]
                grande = Image.fromarray(corte).resize((24 * z, 24 * z), Image.NEAREST)
                x = m + k * passo
                folha.paste(grande, (x, y))
                dg = ImageDraw.Draw(folha)
                for x0, y0, x1, y1 in dados["contraformas"][ident]:
                    dg.rectangle([x + x0 * z, y + y0 * z, x + x1 * z - 1, y + y1 * z - 1], outline=(0, 170, 90), width=2)
                cfs = medidas[ident]["medidas"]["24"][tema]["contraformas"]
                texto = " · ".join(f"{c['px_limpos']}/{c['px_dentro']}" for c in cfs) or "sem contraformas"
                d.text((x, y + 24 * z + 4), f"{ident} · {tema}", font=negrito, fill=(22, 18, 15))
                d.text((x, y + 24 * z + 26), texto, font=pequena, fill=(90, 82, 75))
            y += 24 * z + 70
    folha.save("folha-contraformas.png")


folha_canva()
folha_contraformas()
