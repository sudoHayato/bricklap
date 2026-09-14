"""
As famílias da sessão 19: quatro sementes do CTO, varridas à volta delas.

Python puro, como o familias.py, de quem usa o contorno, o arredondamento e a
espessura. A diferença está na grelha: estas famílias vivem na **grelha de 24
do CTO**, com a margem que as sementes já trazem (as peças ocupam de 3 a 21),
em coordenadas do SVG (y para baixo). Não se normaliza nada: a 24 px uma
unidade é um píxel, e as juntas das sementes caem na grelha de píxeis tal como
foram desenhadas. Só no fim se passa para a grelha de 100 com y para cima, que
é a que o gerar.py sabe pousar — e aí a caixa de 24 inteira, margem incluída,
mede 100.

Parâmetros, todos em unidades da grelha de 24:
  espessura    a grossura das peças (o braço do L, a barra, o bloco)
  junta        a largura do vão entre peças
  desencontro  o que cada família desencontra (ver cada função)
  raio         o raio de todos os cantos, convexos e côncavos, de 0 a 2,5
O "vazio" não é um eixo à parte: nas quatro sementes o espaço vazio é o que a
espessura deixa, e mexer num é mexer no outro (explicado em cada função).

Tom claro: a peça que faz o pé do L, como na marca atual, em que o pilar
escuro com o retângulo claro de baixo se lia como L.
"""

import json
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import familias  # noqa: E402

GRELHA = 24


def ret(x, y, w, h):
    """rect(x, y, w, h) do SVG -> (x0, y0, x1, y1)."""
    return (x, y, x + w, y + h)


def _peca(somar, tom="B"):
    return {"somar": [tuple(round(v, 9) + 0.0 for v in r) for r in somar], "tom": tom}


# ---------------------------------------------------------------------------
# As sementes, tal como o CTO as desenhou
# ---------------------------------------------------------------------------

SEMENTES = {
    "S1": ("L de duas peças", [_peca([ret(4, 3, 7, 18)]), _peca([ret(13, 14, 8, 7)], "L")]),
    "S2": (
        "volta em degrau",
        [_peca([ret(8, 3, 12, 5)]), _peca([ret(9, 9.5, 6, 5)]), _peca([ret(4, 16, 12, 5)], "L")],
    ),
    "S3": (
        "escada",
        [_peca([ret(3, 15, 8, 6)], "L"), _peca([ret(8, 9, 8, 6)]), _peca([ret(13, 3, 8, 6)])],
    ),
    "S4": (
        "encaixe em L",
        [
            _peca([ret(3, 3, 16, 6), ret(3, 3, 6, 10)]),
            _peca([ret(5, 15, 16, 6), ret(15, 11, 6, 10)], "L"),
        ],
    ),
}


# ---------------------------------------------------------------------------
# As famílias
# ---------------------------------------------------------------------------


def pecas_em_l(p):
    """S1. Haste à esquerda e pé em baixo, em x 4..21 e y 3..21 como a semente.

    `desencontro` diz de quem é o canto: 0 = da haste, que desce até ao fundo
    e o pé fica ao lado dela (a semente); 1 = do pé, que corre a largura toda e
    a haste fica por cima dele. O vazio é o quadrante de cima à direita, e
    mede o que a espessura deixa.
    """
    t, g = p["espessura"], p["junta"]
    if p["desencontro"] == 0:
        return [_peca([(4, 3, 4 + t, 21)]), _peca([(4 + t + g, 21 - t, 21, 21)], "L")]
    if p["desencontro"] == 1:
        return [_peca([(4, 3, 4 + t, 21 - t - g)]), _peca([(4, 21 - t, 21, 21)], "L")]
    raise ValueError("o desencontro da S1 é 0 (canto na haste) ou 1 (canto no pé)")


def volta_em_degrau(p):
    """S2. Três barras empilhadas: a de cima desviada para a direita, a de baixo
    para a esquerda, a do meio mais curta e ao centro.

    `desencontro` é o desvio de cada barra comprida em relação ao centro (2 na
    semente: a de cima de 8 a 20, a de baixo de 4 a 16). A altura total é
    3 × espessura + 2 × junta, centrada na grelha. Não há vazio: o que separa
    as barras é a junta.
    """
    t, g, d = p["espessura"], p["junta"], p["desencontro"]
    y0 = 12 - (3 * t + 2 * g) / 2
    return [
        _peca([(6 + d, y0, 18 + d, y0 + t)]),
        _peca([(9, y0 + t + g, 15, y0 + 2 * t + g)]),
        _peca([(6 - d, y0 + 2 * (t + g), 18 - d, y0 + 3 * t + 2 * g)], "L"),
    ]


def escada(p):
    """S3. Três blocos em degrau, de baixo à esquerda para cima à direita.

    A largura total fica em 3..21. `desencontro` é quanto cada bloco se
    sobrepõe, na horizontal, ao de baixo (3 na semente: blocos de 8, passo de
    5). A altura total é 3 × espessura + 2 × junta, centrada. Na semente a
    junta é zero e os blocos tocam-se: aqui a junta é sempre um eixo. O vazio
    são os dois cantos que a escada não ocupa, e mede o que a espessura deixa.
    """
    t, g, o = p["espessura"], p["junta"], p["desencontro"]
    w = (18 + 2 * o) / 3
    passo = w - o
    y0 = 12 - (3 * t + 2 * g) / 2
    return [
        _peca([(3, y0 + 2 * (t + g), 3 + w, y0 + 3 * t + 2 * g)], "L"),
        _peca([(3 + passo, y0 + t + g, 3 + passo + w, y0 + 2 * t + g)]),
        _peca([(3 + 2 * passo, y0, 21, y0 + t)]),
    ]


def encaixe_em_l(p):
    """S4. Duas peças em L que fecham o quadrado 3..21 à volta de um vazio.

    A de cima (barra e perna à esquerda) é escura; a de baixo (barra e perna à
    direita) leva o pé, e é clara. `desencontro` é o entalhe de cada barra no
    canto oposto (2 na semente: a barra de cima acaba em 19, a de baixo começa
    em 5); com 0 as barras correm o lado inteiro, que é o L221 da sessão 18
    com outra espessura. O vazio central mede 18 − 2 × espessura de lado: é a
    espessura que o decide.
    """
    t, g, d = p["espessura"], p["junta"], p["desencontro"]
    return [
        _peca([(3, 3, 21 - d, 3 + t), (3, 3, 3 + t, 21 - t - g)]),
        _peca([(3 + d, 21 - t, 21, 21), (21 - t, 3 + t + g, 21, 21)], "L"),
    ]


FAMILIAS = {
    "S1": pecas_em_l,
    "S2": volta_em_degrau,
    "S3": escada,
    "S4": encaixe_em_l,
}


# ---------------------------------------------------------------------------
# Construção: grelha de 24 (y para baixo) -> peças do gerar.py (grelha de 100, y para cima)
# ---------------------------------------------------------------------------


def perda_no_circulo(pecas, raio, passo=0.05):
    """A maior fração de área que um retângulo da construção perde fora do círculo.

    Cada retângulo de uma peça é uma perna (numa peça em L, a barra e a perna
    contam cada uma). Mede-se nos retângulos sem os cantos arredondados, que é
    o pior caso: arredondar só tira área dos cantos, que é onde o círculo corta.
    Devolve (fração, índice da peça).
    """
    pior, qual = 0.0, None
    for k, peca in enumerate(pecas):
        for x0, y0, x1, y1 in peca["somar"]:
            nx = max(1, round((x1 - x0) / passo))
            ny = max(1, round((y1 - y0) / passo))
            fora = 0
            for i in range(nx):
                dx = x0 + (i + 0.5) * (x1 - x0) / nx - GRELHA / 2
                for j in range(ny):
                    dy = y0 + (j + 0.5) * (y1 - y0) / ny - GRELHA / 2
                    if dx * dx + dy * dy > raio * raio:
                        fora += 1
            fracao = fora / (nx * ny)
            if fracao > pior:
                pior, qual = fracao, k
    return pior, qual


def construir(pecas, raio):
    escala = 100 / GRELHA
    finais = []
    for peca in pecas:
        contornos = familias.contornar(peca["somar"])
        espessura = familias.espessura_minima(contornos)
        redondos = [familias.arredondar(c, raio) for c in contornos]
        finais.append(
            {
                "tom": peca["tom"],
                "espessura": espessura * escala,
                "contornos": [[(x * escala, (GRELHA - y) * escala) for x, y in c] for c in redondos],
            }
        )
    return finais


def _variante(ident, familia, nome, parametros, variacao, pecas, circulo):
    perda, peca = perda_no_circulo(pecas, circulo)
    return {
        "id": ident,
        "familia": familia,
        "nome": nome,
        "parametros": parametros,
        "variacao": variacao,
        "pecas": construir(pecas, parametros.get("raio", 0)),
        "largura": 100.0,
        "altura": 100.0,
        "recorte": {"perda": perda, "peca": peca},
        "junta": parametros.get("junta"),
    }


def referencias(circulo):
    """O símbolo atual e as quatro sementes tal como foram desenhadas, fora da contagem."""
    ref = familias.referencia()
    ref["recorte"], ref["junta"] = None, 1.2
    saida = [ref]
    for chave, (nome, pecas) in SEMENTES.items():
        juntas = {"S1": 2, "S2": 1.5, "S3": 0, "S4": 2}
        saida.append(_variante(chave, "SEM", nome, {"raio": 0, "junta": juntas[chave]}, {}, pecas, circulo))
    return saida


def variantes(parametros):
    circulo = parametros["recorte"]["raio_na_grelha"]
    saida, ids = [], set()
    for fam in parametros["familias"]:
        funcao = FAMILIAS[fam["semente"]]
        nomes = [eixo[0] for eixo in fam["eixos"]]
        valores = [eixo[1] for eixo in fam["eixos"]]
        indices = [[]]
        for v in valores:
            indices = [prefixo + [i] for prefixo in indices for i in range(len(v))]
        for combinacao in indices:
            p = dict(fam["fixos"])
            p.update({nome: valores[k][i] for k, (nome, i) in enumerate(zip(nomes, combinacao))})
            ident = fam["letra"] + "".join(str(i + 1) for i in combinacao)
            if ident in ids:
                raise ValueError(f"id repetido: {ident}")
            ids.add(ident)
            variacao = {nome: p[nome] for nome in nomes}
            saida.append(_variante(ident, fam["letra"], fam["nome"], p, variacao, funcao(p), circulo))
    return saida


if __name__ == "__main__":
    caminho = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "parametros-sessao-19.json")
    with open(caminho, encoding="utf-8") as f:
        parametros = json.load(f)
    todas = variantes(parametros)
    for v in referencias(parametros["recorte"]["raio_na_grelha"]) + todas:
        tons = "".join(p["tom"] for p in v["pecas"])
        fina = min(p["espessura"] for p in v["pecas"]) * GRELHA / 100
        corte = v["recorte"]
        perda = f"{corte['perda'] * 100:4.1f} %" if corte else "  —  "
        print(f"{v['id']:6} {v['nome']:16} {len(v['pecas'])} peças ({tons}) mais fina {fina:4.2f} px a 24  "
              f"perna mais cortada {perda}  {v['variacao']}")
    print(f"{len(todas)} variantes")
