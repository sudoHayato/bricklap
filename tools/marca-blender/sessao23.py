"""
Sessão 23: medir a ligadura BL (e os dois controlos do Canva) na cadeia calibrada do Blender.

Corre dentro do Blender, sem interface, pelo sessao23.sh ao lado:

    tools/marca-blender/sessao23.sh [pasta]

Importa sem alterar o resto da cadeia (gerar.py: cena, folha, regiões;
sessao19.py: materiais dos dois temas, cobertura, círculo; sessao19b.py:
desfoque) e usa as cores do parametros-sessao-19b.json. Os dois controlos do
Canva vêm de controlos-sessao-23.json (sessao23_tracar.py).

Folhas: folha-24px.png, folha-medicao.png (73, 48, 24), folha-recorte.png,
folha-desfoque.png. Tabelas: medidas.md, medidas.json; caixas.json para a
folha ampliada das contraformas (feita fora do Blender).
"""

import argparse
import json
import math
import os
import sys

sys.dont_write_bytecode = True

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
opcoes_ap = argparse.ArgumentParser(prog="sessao23.py")
opcoes_ap.add_argument("--saida", required=True)
opcoes_ap.add_argument("--controlos", required=True)
opcoes = opcoes_ap.parse_args(argv)

CADEIA = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, CADEIA)

import bpy  # noqa: E402,F401
import numpy as np  # noqa: E402

import gerar  # noqa: E402
import ligadura  # noqa: E402
import sessao19  # noqa: E402
import sessao19b  # noqa: E402

TEMAS = ("creme", "escuro")
LIMPA, VE_SE = 0.25, 0.5


def num(v, casas=2):
    return f"{v:.{casas}f}".rstrip("0").rstrip(".").replace(".", ",")


# ---------------------------------------------------------------------------
# Os itens
# ---------------------------------------------------------------------------


def dentro(px, py, contorno):
    """Par-ímpar, vetorizado."""
    x = np.array([p[0] for p in contorno])
    y = np.array([p[1] for p in contorno])
    x2, y2 = np.roll(x, -1), np.roll(y, -1)
    res = np.zeros(px.shape, dtype=bool)
    for a, b, c, d in zip(x, y, x2, y2):
        cruza = ((b > py) != (d > py)) & (px < (c - a) * (py - b) / ((d - b) if d != b else 1e-12) + a)
        res ^= cruza
    return res


def controlos(caminho):
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
    saida = []
    g = np.arange(0.025, 24, 0.05)
    px, py = np.meshgrid(g, g)
    fora = (px - 12) ** 2 + (py - 12) ** 2 > 11**2
    for c in dados:
        tinta = np.zeros(px.shape, dtype=bool)
        for peca in c["pecas"]:
            for contorno in peca:
                tinta ^= dentro(px, py, contorno)
        escala = 100 / 24
        saida.append(
            {
                "id": f"CANVA-{c['id']}",
                "familia": "CONTROLO",
                "nome": {"b1": "controlo do Canva, ronda 2: escada numa silhueta só", "e4": "controlo do Canva, ronda 5: canto inclinado (raio)"}.get(c["id"], c["id"]),
                "pecas": [
                    {"tom": "B", "espessura": 0, "contornos": [[(x * escala, (24 - y) * escala) for x, y in contorno] for contorno in peca]}
                    for peca in c["pecas"]
                ],
                "largura": 100.0,
                "altura": 100.0,
                "contraformas": [],
                "traco": None,
                # para uma forma livre, a perda é a da forma toda fora do círculo (não há retângulos)
                "recorte": {"perda": float((tinta & fora).sum() / tinta.sum())},
            }
        )
    return saida


# ---------------------------------------------------------------------------
# Medidas
# ---------------------------------------------------------------------------


def cobertura(recorte, tema, cores):
    (k,) = sessao19.cobertura(recorte, cores[tema], [cores["B"]])
    return np.clip(k, 0, 1)


def medir_caixa(imagem, caixa, v, cores):
    n, x, y = caixa["tamanho"], caixa["x"], caixa["y"]
    k = cobertura(imagem[y : y + n, x : x + n], caixa["tema"], cores)
    u = n / 24
    centros = np.arange(n) + 0.5
    cx, cy = np.meshgrid(centros, centros)
    furos = {nome: gerar.componentes((k <= lim).astype(np.int8)) - 1 for nome, lim in (("limpa", LIMPA), ("ve_se", VE_SE))}
    pecas = {nome: gerar.componentes((k > lim).astype(np.int8)) for nome, lim in (("limpa", LIMPA), ("ve_se", VE_SE))}
    cfs = []
    for x0, y0, x1, y1 in v["contraformas"]:
        dentro_cf = (cx >= x0 * u) & (cx <= x1 * u) & (cy >= y0 * u) & (cy <= y1 * u)
        area = int(dentro_cf.sum())
        limpos = int((dentro_cf & (k <= LIMPA)).sum())
        ve = int((dentro_cf & (k <= VE_SE)).sum())
        cfs.append({"geometria": [x1 - x0, y1 - y0], "px_dentro": area, "px_limpos": limpos, "px_ve_se": ve})
    return {"furos": furos, "pecas": pecas, "contraformas": cfs, "peso": float(k.mean())}


# ---------------------------------------------------------------------------
# Folhas
# ---------------------------------------------------------------------------


def folha_24(itens):
    m, rotulo, cabeca, linha_a = 20, 70, 64, 52
    largura = m + rotulo + 2 * 40 + m + 40
    folha = gerar.Folha(2 * largura, cabeca + len(itens) * linha_a + m)
    sessao19.paineis(
        folha,
        largura,
        lambda tema: [(f"Sessão 23 · 24 px · {tema}", 15, False), ("#C0402C · tinta. Ver a 100 %.", 12, True)],
    )
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        tinta = "K" if tema == "creme" else "uma_cor_escuro"
        for r, v in enumerate(itens):
            y = cabeca + r * linha_a
            folha.escrever(v["id"].replace("CANVA-", ""), x0 + m, y + 6, 11, sessao19.cor_do_texto(tema, True))
            folha.pousar(v, x0 + m + rotulo, y, 24, False, {"B": "B", "L": "B"}, tema=tema, cor="marca")
            folha.pousar(v, x0 + m + rotulo + 40, y, 24, True, {"B": tinta, "L": tinta}, tema=tema, cor="tinta")
    return folha


def folha_medicao(itens):
    m, cabeca, linha_a, largura = 20, 64, 73 + 34, 720
    folha = gerar.Folha(2 * largura, cabeca + len(itens) * linha_a + m)
    sessao19.paineis(
        folha,
        largura,
        lambda tema: [
            (f"Bricklap · sessão 23 · a ligadura BL, o antes e a P2122 a 73, 48 e 24 px · {tema}", 15, False),
            ("Uma cor, #C0402C. À escala real, nada ampliado. Os dois CANVA são controlos, chumbados no juízo.", 12, True),
        ],
    )
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        for r, v in enumerate(itens):
            y = cabeca + r * linha_a
            for dx, n, dy in ((0, 73, 0), (89, 48, 12), (153, 24, 24)):
                folha.pousar(v, x0 + m + dx, y + dy, n, False, {"B": "B", "L": "B"}, tema=tema, cor="marca")
            folha.escrever(v["id"], x0 + m + 200, y + 14, 16, sessao19.cor_do_texto(tema))
            folha.escrever(v["nome"], x0 + m + 200, y + 42, 12, sessao19.cor_do_texto(tema, True))
    return folha


def folha_recorte(itens, raio_grelha=11):
    caixa = 144
    raio = raio_grelha / 24 * caixa
    m, cabeca, passo, linha_a = 20, 64, caixa + 36, caixa + 40
    colunas = 2
    largura = m + colunas * (3 * passo + 150) + m
    linhas = math.ceil(len(itens) / colunas)
    folha = gerar.Folha(largura, cabeca + linhas * linha_a + m)
    folha.retangulo(0, 0, largura, folha.altura, "recorte_fundo", -1.0)
    folha.escrever("Bricklap · sessão 23 · recorte circular do ícone adaptativo (janela de 72 dp, círculo de 66 dp)", m, 14, 15)
    folha.escrever("Em cada item: sobre o creme, o escuro e o campo do ícone da app. Uma cor.", m, 38, 12)
    tratamentos = (("creme", {"B": "B", "L": "B"}), ("escuro", {"B": "B", "L": "B"}), ("campo", {"B": "campo_peca", "L": "campo_peca"}))
    for i, v in enumerate(itens):
        c, r = i % colunas, i // colunas
        bx = m + c * (3 * passo + 150)
        y = cabeca + r * linha_a
        for j, (fundo, mapa) in enumerate(tratamentos):
            x = bx + j * passo
            cx, cy = x + caixa / 2, y + caixa / 2
            folha.poligono([sessao19.circulo(cx, cy, raio)], fundo, -0.5)
            folha.pousar(v, x, y, caixa, False, mapa)
            aro = [(x - 2, y - 2), (x + caixa + 2, y - 2), (x + caixa + 2, y + caixa + 2), (x - 2, y + caixa + 2)]
            folha.poligono([aro, list(reversed(sessao19.circulo(cx, cy, raio)))], "recorte_fundo", 0.5)
        folha.escrever(v["id"], bx + 3 * passo, y + 20, 16)
        folha.escrever(f"perda {num(v['recorte']['perda'] * 100, 1)} %", bx + 3 * passo, y + 48, 12)
    return folha


# ---------------------------------------------------------------------------


def main():
    with open(os.path.join(CADEIA, "parametros-sessao-19b.json"), encoding="utf-8") as f:
        parametros = json.load(f)
    cores = dict(parametros["cores"])
    sigma = parametros["desfoque"]["sigma_px"]
    tol = parametros["desfoque"]["tolerancia"]
    os.makedirs(opcoes.saida, exist_ok=True)

    itens = [ligadura.p2122()] + ligadura.todas() + controlos(opcoes.controlos)
    materiais = sessao19.materiais_da_sessao(cores)
    caminho = {n: os.path.join(opcoes.saida, f"{n}.png") for n in ("folha-24px", "folha-medicao", "folha-recorte", "folha-desfoque")}

    f24 = folha_24(itens)
    f24.renderizar(caminho["folha-24px"], parametros["amostras"]["folha_24"], materiais)
    fmed = folha_medicao(itens)
    fmed.renderizar(caminho["folha-medicao"], parametros["amostras"]["medicao"], materiais)
    folha_recorte(itens).renderizar(caminho["folha-recorte"], parametros["amostras"]["recorte"], materiais)

    img24, imgmed = gerar.ler_png(caminho["folha-24px"]), gerar.ler_png(caminho["folha-medicao"])
    por_id = {v["id"]: v for v in itens}
    medidas = {v["id"]: {} for v in itens}
    for imagem, folha, tamanhos in ((img24, f24, {24}), (imgmed, fmed, {48, 73})):
        for caixa in folha.caixas:
            if caixa["tamanho"] in tamanhos and caixa.get("cor") == "marca":
                medidas[caixa["id"]].setdefault(str(caixa["tamanho"]), {})[caixa["tema"]] = medir_caixa(imagem, caixa, por_id[caixa["id"]], cores)

    # o desfoque da 19b: a uma cor (tinta) sobre o creme, a 24 px
    desfoque = sessao19b.medir_desfoque(img24, f24, cores, sigma)
    ancora = desfoque["P2122"]
    vereditos = {}
    for v in itens:
        d = desfoque[v["id"]]
        vereditos[v["id"]] = {"destoa": abs(d["peso"] / ancora["peso"] - 1) > tol or abs(d["mancha"] / ancora["mancha"] - 1) > tol}
    lista = [("", "", itens[i : i + 4]) for i in range(0, len(itens), 4)]
    fdes, vazios = sessao19b.folha_desfoque_base(lista, desfoque, vereditos)
    fdes.renderizar(caminho["folha-desfoque"], parametros["amostras"]["folha_24"], materiais)
    sessao19b.encher_desfoque(caminho["folha-desfoque"], vazios, cores, sigma)

    linhas = [
        "| id | traço | contraformas na grelha (l × a) | 24 px: furos abertos, limpa (creme · escuro) | 24 px: píxeis limpos por contraforma (creme) | 48 px: furos limpa (creme · escuro) | 73 px: furos limpa (creme · escuro) | 73 px: píxeis limpos por contraforma (creme) | recorte: perda | desfoque: peso · mancha |",
        "|---|---:|---|---|---|---|---|---|---:|---|",
    ]
    for v in itens:
        me = medidas[v["id"]]
        cf = " · ".join(f"{num(a)} × {num(b)}" for a, b in [(x1 - x0, y1 - y0) for x0, y0, x1, y1 in v["contraformas"]]) or "—"

        def furos(n):
            return " · ".join(str(me[str(n)][t]["furos"]["limpa"]) for t in TEMAS)

        def limpos(n):
            return " · ".join(f"{c['px_limpos']}/{c['px_dentro']}" for c in me[str(n)]["creme"]["contraformas"]) or "—"

        d = desfoque[v["id"]]
        linhas.append(
            f"| {v['id']} | {v['traco'] if v['traco'] is not None else '—'} | {cf} | {furos(24)} | {limpos(24)} | {furos(48)} | {furos(73)} | {limpos(73)} "
            f"| {num(v['recorte']['perda'] * 100, 1)} % | {num(d['peso'])} · {num(d['mancha'])}{' · **destoa**' if vereditos[v['id']]['destoa'] else ''} |"
        )
    with open(os.path.join(opcoes.saida, "medidas.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")
    with open(os.path.join(opcoes.saida, "medidas.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                v["id"]: {
                    "nome": v["nome"],
                    "traco": v["traco"],
                    "contraformas": v["contraformas"],
                    "recorte": v["recorte"],
                    "desfoque": {"peso": desfoque[v["id"]]["peso"], "mancha": desfoque[v["id"]]["mancha"], "destoa": vereditos[v["id"]]["destoa"]},
                    "medidas": medidas[v["id"]],
                }
                for v in itens
            },
            f,
            ensure_ascii=False,
            indent=1,
        )
    with open(os.path.join(opcoes.saida, "caixas.json"), "w", encoding="utf-8") as f:
        json.dump({"folha-24px": f24.caixas, "contraformas": {v["id"]: v["contraformas"] for v in itens}}, f, ensure_ascii=False)
    print("[marca] sessão 23 pronta:", opcoes.saida)


main()
