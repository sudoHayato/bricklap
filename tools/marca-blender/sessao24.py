"""
Sessão 24: o repertório das regras abertas, medido na cadeia calibrada.

Corre dentro do Blender, sem interface, pelo sessao24.sh ao lado:

    tools/marca-blender/sessao24.sh <pasta-das-formas> [pasta-de-saída]

A sessão 25 usa este mesmo medidor pelo sessao25.sh, com --ficheiro formas.json,
--sessao 25 e --titulo: mudam o ficheiro de entrada e o título das folhas, mais
nada. Com os valores por omissão, a sessão 24 volta a sair píxel a píxel igual.

Lê <pasta-das-formas>/formas-sessao-24.json (o sessao24_formas.py) e pousa as
variantes com a P2122 como âncora. Importa sem alterar o resto da cadeia
(gerar.py, sessao19.py, sessao19b.py; a P2122 de ligadura.py) e usa as cores do
parametros-sessao-19b.json. Uma cor, #C0402C, em todas as folhas.

Folhas: folha-24px.png, folha-medicao.png (73, 48, 24), folha-recorte.png,
folha-desfoque.png. Tabelas: medidas.json e caixas.json (para o
sessao24_folhas.py, que junta as leituras e a semelhança).

As medidas automáticas a 24, 48 e 73 px, nos dois temas: as peças (regiões de
tinta acima de 25 % de cobertura) e os furos (regiões de fundo com 25 % ou menos,
tirando o de fora), contra os que a forma tem em alta resolução — uma junta que
cola duas peças ou uma contraforma que se fecha contam como perda; o recorte, a
fração da tinta fora do círculo de 66 dp; o desfoque da 19b (peso e mancha contra
a P2122, ±25 %).
"""

import argparse
import json
import math
import os
import sys

sys.dont_write_bytecode = True

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
opcoes_ap = argparse.ArgumentParser(prog="sessao24.py")
opcoes_ap.add_argument("--formas", required=True)
opcoes_ap.add_argument("--saida", required=True)
opcoes_ap.add_argument("--ficheiro", default="formas-sessao-24.json")
opcoes_ap.add_argument("--sessao", default="24")
opcoes_ap.add_argument("--titulo", default="regras abertas")
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
LIMPA = 0.25


def num(v, casas=2):
    return f"{v:.{casas}f}".rstrip("0").rstrip(".").replace(".", ",")


def cobertura(recorte, tema, cores):
    (k,) = sessao19.cobertura(recorte, cores[tema], [cores["B"]])
    return np.clip(k, 0, 1)


def medir_caixa(imagem, caixa, cores):
    n, x, y = caixa["tamanho"], caixa["x"], caixa["y"]
    k = cobertura(imagem[y : y + n, x : x + n], caixa["tema"], cores)
    return {
        "pecas": gerar.componentes((k > LIMPA).astype(np.int8)),
        "furos": gerar.componentes((k <= LIMPA).astype(np.int8)) - 1,
        "peso": float(k.mean()),
    }


def folha_24(itens):
    m, rotulo, cabeca, passo_linha, colunas = 20, 56, 64, 44, 4
    largura_col = rotulo + 24 + 16
    largura = m + colunas * largura_col + m
    linhas = math.ceil(len(itens) / colunas)
    folha = gerar.Folha(2 * largura, cabeca + linhas * passo_linha + m)
    sessao19.paineis(folha, largura, lambda tema: [(f"Sessão {opcoes.sessao} · 24 px · {tema}", 15, False), ("#C0402C. Ver a 100 %.", 12, True)])
    for k, tema in enumerate(TEMAS):
        for i, v in enumerate(itens):
            x = k * largura + m + (i % colunas) * largura_col
            y = cabeca + (i // colunas) * passo_linha
            folha.escrever(v["id"], x, y + 6, 11, sessao19.cor_do_texto(tema, True))
            folha.pousar(v, x + rotulo, y, 24, False, {"B": "B", "L": "B"}, tema=tema, cor="marca")
    return folha


def folha_desfoque_24(itens):
    """As caixas a uma cor que o sessao19b.medir_desfoque procura (24 px, tema creme, uma_cor)."""
    m, cabeca, passo, colunas = 20, 20, 40, 10
    linhas = math.ceil(len(itens) / colunas)
    folha = gerar.Folha(m + colunas * passo + m, cabeca + linhas * passo + m)
    folha.retangulo(0, 0, folha.largura, folha.altura, "creme", -1.0)
    for i, v in enumerate(itens):
        folha.pousar(v, m + (i % colunas) * passo, cabeca + (i // colunas) * passo, 24, True, {"B": "K", "L": "K"}, tema="creme")
    return folha


def folha_medicao(itens):
    m, cabeca, linha_a, largura, colunas = 20, 64, 73 + 30, 440, 3
    linhas = math.ceil(len(itens) / colunas)
    folha = gerar.Folha(2 * colunas * largura, cabeca + linhas * linha_a + m)
    sessao19.paineis(
        folha,
        colunas * largura,
        lambda tema: [(f"Bricklap · sessão {opcoes.sessao} · {opcoes.titulo} · 73, 48 e 24 px · {tema}", 15, False), ("Uma cor, #C0402C. À escala real, nada ampliado.", 12, True)],
    )
    for k, tema in enumerate(TEMAS):
        for i, v in enumerate(itens):
            x0 = k * colunas * largura + m + (i % colunas) * largura
            y = cabeca + (i // colunas) * linha_a
            for dx, n, dy in ((0, 73, 0), (89, 48, 12), (153, 24, 24)):
                folha.pousar(v, x0 + dx, y + dy, n, False, {"B": "B", "L": "B"}, tema=tema, cor="marca")
            folha.escrever(v["id"], x0 + 190, y + 14, 15, sessao19.cor_do_texto(tema))
            folha.escrever(v.get("conceito", "âncora"), x0 + 190, y + 40, 11, sessao19.cor_do_texto(tema, True))
    return folha


def folha_recorte(itens, raio_grelha=11):
    caixa = 96
    raio = raio_grelha / 24 * caixa
    m, cabeca, passo, linha_a, colunas = 20, 64, caixa + 16, caixa + 36, 3
    bloco = 3 * passo + 70
    largura = m + colunas * bloco + m
    linhas = math.ceil(len(itens) / colunas)
    folha = gerar.Folha(largura, cabeca + linhas * linha_a + m)
    folha.retangulo(0, 0, largura, folha.altura, "recorte_fundo", -1.0)
    folha.escrever(f"Bricklap · sessão {opcoes.sessao} · recorte circular do ícone adaptativo (janela de 72 dp, círculo de 66 dp)", m, 14, 15)
    folha.escrever("Em cada variante: sobre o creme, o escuro e o campo do ícone da app. Uma cor.", m, 38, 12)
    tratamentos = (("creme", {"B": "B", "L": "B"}), ("escuro", {"B": "B", "L": "B"}), ("campo", {"B": "campo_peca", "L": "campo_peca"}))
    for i, v in enumerate(itens):
        bx = m + (i % colunas) * bloco
        y = cabeca + (i // colunas) * linha_a
        for j, (fundo, mapa) in enumerate(tratamentos):
            x = bx + j * passo
            cx, cy = x + caixa / 2, y + caixa / 2
            folha.poligono([sessao19.circulo(cx, cy, raio)], fundo, -0.5)
            folha.pousar(v, x, y, caixa, False, mapa)
            aro = [(x - 2, y - 2), (x + caixa + 2, y - 2), (x + caixa + 2, y + caixa + 2), (x - 2, y + caixa + 2)]
            folha.poligono([aro, list(reversed(sessao19.circulo(cx, cy, raio)))], "recorte_fundo", 0.5)
        folha.escrever(v["id"], bx + 3 * passo, y + 20, 14)
        folha.escrever(f"{num(v['recorte']['perda'] * 100, 1)} %", bx + 3 * passo, y + 44, 11)
    return folha


def main():
    with open(os.path.join(CADEIA, "parametros-sessao-19b.json"), encoding="utf-8") as f:
        parametros = json.load(f)
    cores = dict(parametros["cores"])
    sigma = parametros["desfoque"]["sigma_px"]
    tol = parametros["desfoque"]["tolerancia"]
    os.makedirs(opcoes.saida, exist_ok=True)
    with open(os.path.join(opcoes.formas, opcoes.ficheiro), encoding="utf-8") as f:
        formas = json.load(f)
    variantes = formas["variantes"]

    ancora = ligadura.p2122()
    ancora.update({"conceito": "âncora: a P2122", "pecas_n": 2, "furos_n": 0})
    # a perda da P2122 na régua das formas livres (a forma inteira), ao lado da régua das pernas da 19
    ancora["recorte"] = {"perda": formas["p2122_perda_forma"], "perda_regua_19": ancora["recorte"]["perda"]}
    itens = [ancora] + variantes
    materiais = sessao19.materiais_da_sessao(cores)
    caminho = {n: os.path.join(opcoes.saida, f"{n}.png") for n in ("folha-24px", "folha-medicao", "folha-recorte", "folha-desfoque", "folha-uma-cor-24")}

    f24 = folha_24(itens)
    f24.renderizar(caminho["folha-24px"], parametros["amostras"]["folha_24"], materiais)
    fuc = folha_desfoque_24(itens)
    fuc.renderizar(caminho["folha-uma-cor-24"], parametros["amostras"]["folha_24"], materiais)
    fmed = folha_medicao(itens)
    fmed.renderizar(caminho["folha-medicao"], parametros["amostras"]["medicao"], materiais)
    frec = folha_recorte(itens)
    frec.renderizar(caminho["folha-recorte"], parametros["amostras"]["recorte"], materiais)

    img24, imgmed, imguc = (gerar.ler_png(caminho[n]) for n in ("folha-24px", "folha-medicao", "folha-uma-cor-24"))
    medidas = {v["id"]: {} for v in itens}
    for imagem, folha, tamanhos in ((img24, f24, {24}), (imgmed, fmed, {48, 73})):
        for caixa in folha.caixas:
            if caixa["tamanho"] in tamanhos and caixa.get("cor") == "marca":
                medidas[caixa["id"]].setdefault(str(caixa["tamanho"]), {})[caixa["tema"]] = medir_caixa(imagem, caixa, cores)

    desfoque = sessao19b.medir_desfoque(imguc, fuc, cores, sigma)
    a = desfoque["P2122"]
    vereditos = {v["id"]: {"destoa": abs(desfoque[v["id"]]["peso"] / a["peso"] - 1) > tol or abs(desfoque[v["id"]]["mancha"] / a["mancha"] - 1) > tol} for v in itens}
    lista = [("", "", itens[i : i + 4]) for i in range(0, len(itens), 4)]
    fdes, vazios = sessao19b.folha_desfoque_base(lista, desfoque, vereditos)
    fdes.renderizar(caminho["folha-desfoque"], parametros["amostras"]["folha_24"], materiais)
    sessao19b.encher_desfoque(caminho["folha-desfoque"], vazios, cores, sigma)

    saida = {}
    for v in itens:
        me = medidas[v["id"]]
        perdas = {}
        for n in ("24", "48", "73"):
            perdas[n] = {t: {"pecas_coladas": me[n][t]["pecas"] < v["pecas_n"], "furos_fechados": max(0, v["furos_n"] - me[n][t]["furos"])} for t in TEMAS}
        saida[v["id"]] = {
            "conceito": v.get("conceito"),
            "nome": v["nome"],
            "categoria": v.get("categoria"),
            "novas": v.get("novas"),
            "pecas_n": v["pecas_n"],
            "furos_n": v["furos_n"],
            "recorte": v["recorte"],
            "desfoque": {"peso": desfoque[v["id"]]["peso"], "mancha": desfoque[v["id"]]["mancha"], "destoa": vereditos[v["id"]]["destoa"]},
            "medidas": me,
            "perdas": perdas,
            "legivel_24_auto": all(not perdas["24"][t]["pecas_coladas"] and perdas["24"][t]["furos_fechados"] == 0 for t in TEMAS),
        }
    with open(os.path.join(opcoes.saida, "medidas.json"), "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=1)
    with open(os.path.join(opcoes.saida, "caixas.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "folha-24px": f24.caixas,
                "folha-medicao": fmed.caixas,
                "folha-recorte": frec.caixas,
                "folha-desfoque": [{"id": i, "x": x, "y": y} for i, x, y in vazios],
            },
            f,
            ensure_ascii=False,
        )
    print(f"[marca] sessão {opcoes.sessao} pronta:", opcoes.saida)


main()
