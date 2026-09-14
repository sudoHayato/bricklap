"""
Geometria das famílias de silhuetas da marca Bricklap (sessão 18).

Python puro, sem `bpy`: o `gerar.py` importa-o dentro do Blender, e corre
também fora dele (`python3 familias.py parametros.json`), para se verificar a
geometria sem abrir o Blender.

Cada família é uma regra que, dados os parâmetros, devolve peças. Uma peça é
uma região retilínea — só cortes a 90° — descrita por retângulos somados e
retângulos cortados, numa grelha de trabalho da própria família. O caminho
até ao desenho final é o mesmo para todas:

  1. rodar em passos de 90°;
  2. contornar cada peça (um contorno exterior e os seus furos);
  3. normalizar: a maior dimensão da marca passa a medir 100;
  4. abrir as juntas: recuar todos os contornos de metade do vão e voltar a
     escalar para 100, de modo que o vão final mede exatamente `espacamento`
     unidades da grelha de 100 — a mesma grelha do docs/marca/README.md;
  5. arredondar todos os cantos, convexos e côncavos, com o mesmo raio.

Os parâmetros têm os nomes do brief: `pecas`, `proporcao`, `desencontro`,
`espacamento`, `rotacao`, `vazio`, mais `raio` (cantos) e os poucos que só
uma família usa (`moldura`, `tom_claro`).
"""

import itertools
import json
import math
import sys

# ---------------------------------------------------------------------------
# Regiões retilíneas
# ---------------------------------------------------------------------------


def rodar_retangulo(r, graus):
    """Roda (x0, y0, x1, y1) em torno da origem, no sentido anti-horário."""
    x0, y0, x1, y1 = r
    g = graus % 360
    if g == 0:
        return r
    if g == 90:  # (x, y) -> (-y, x)
        return (-y1, x0, -y0, x1)
    if g == 180:  # (x, y) -> (-x, -y)
        return (-x1, -y1, -x0, -y0)
    if g == 270:  # (x, y) -> (y, -x)
        return (y0, -x1, y1, -x0)
    raise ValueError(f"a rotação é em passos de 90°, não {graus}°")


def area(contorno):
    """Área com sinal: positiva no sentido anti-horário."""
    s = 0.0
    for k in range(len(contorno)):
        x0, y0 = contorno[k - 1]
        x1, y1 = contorno[k]
        s += x0 * y1 - x1 * y0
    return s / 2


def _sem_colineares(pontos):
    fica = []
    n = len(pontos)
    for k in range(n):
        ax, ay = pontos[k - 1]
        bx, by = pontos[k]
        cx, cy = pontos[(k + 1) % n]
        if (bx - ax) * (cy - by) - (by - ay) * (cx - bx) != 0:
            fica.append(pontos[k])
    return fica


def contornar(somar, cortar=()):
    """Contornos de uma região retilínea: `[exterior, *furos]`.

    O exterior sai no sentido anti-horário e os furos no horário: a região
    fica sempre à esquerda de quem percorre um contorno, e é isso que o
    recuo das juntas usa para saber para que lado recuar.
    """
    todos = list(somar) + list(cortar)
    xs = sorted({v for r in todos for v in (r[0], r[2])})
    ys = sorted({v for r in todos for v in (r[1], r[3])})

    def cobre(r, x, y):
        return r[0] < x < r[2] and r[1] < y < r[3]

    cheio = set()
    for i in range(len(xs) - 1):
        cx = (xs[i] + xs[i + 1]) / 2
        for j in range(len(ys) - 1):
            cy = (ys[j] + ys[j + 1]) / 2
            if any(cobre(r, cx, cy) for r in somar) and not any(cobre(r, cx, cy) for r in cortar):
                cheio.add((i, j))

    seguinte = {}

    def aresta(a, b):
        if a in seguinte:
            raise ValueError("peça com dois cantos a tocar-se em diagonal")
        seguinte[a] = b

    for i, j in cheio:
        if (i, j - 1) not in cheio:
            aresta((i, j), (i + 1, j))
        if (i + 1, j) not in cheio:
            aresta((i + 1, j), (i + 1, j + 1))
        if (i, j + 1) not in cheio:
            aresta((i + 1, j + 1), (i, j + 1))
        if (i - 1, j) not in cheio:
            aresta((i, j + 1), (i, j))

    contornos = []
    while seguinte:
        inicio = next(iter(seguinte))
        laco, v = [], inicio
        while True:
            laco.append(v)
            v = seguinte.pop(v)
            if v == inicio:
                break
        contornos.append([(xs[i], ys[j]) for i, j in _sem_colineares(laco)])

    exteriores = [c for c in contornos if area(c) > 0]
    furos = [c for c in contornos if area(c) < 0]
    if len(exteriores) != 1:
        raise ValueError(f"uma peça tem de ser uma região só, e esta tem {len(exteriores)}")
    return exteriores + furos


def recuar(contorno, d):
    """Recua todas as arestas de um contorno retilíneo `d` para dentro da região."""
    n = len(contorno)
    novo = []
    for k in range(n):
        ax, ay = contorno[k - 1]
        bx, by = contorno[k]
        cx, cy = contorno[(k + 1) % n]
        d1 = (math.copysign(1, bx - ax) if bx != ax else 0, math.copysign(1, by - ay) if by != ay else 0)
        d2 = (math.copysign(1, cx - bx) if cx != bx else 0, math.copysign(1, cy - by) if cy != by else 0)
        # normal à esquerda de (dx, dy) é (-dy, dx); a aresta horizontal dá o y, a vertical dá o x
        if d1[1] == 0:
            novo.append((bx - d2[1] * d, by + d1[0] * d))
        else:
            novo.append((bx - d1[1] * d, by + d2[0] * d))
    for k in range(n):
        antes = (contorno[k][0] - contorno[k - 1][0], contorno[k][1] - contorno[k - 1][1])
        depois = (novo[k][0] - novo[k - 1][0], novo[k][1] - novo[k - 1][1])
        if antes[0] * depois[0] <= 0 and antes[1] * depois[1] <= 0:
            raise ValueError("o vão é maior do que a peça aguenta: uma aresta desapareceu")
    return novo


def espessura_minima(contornos):
    """A parte mais fina de uma peça retilínea, nas unidades dos contornos.

    Em cada célula da grelha comprimida mede-se o troço cheio que passa por
    ela na horizontal e na vertical; a espessura local é o menor dos dois, e a
    da peça é a menor de todas. Num L é a largura do braço; num tijolo com um
    entalhe, o que sobra ao lado ou por baixo do entalhe.
    """
    contornos = [[(round(x, 6), round(y, 6)) for x, y in c] for c in contornos]
    xs = sorted({x for c in contornos for x, _ in c})
    ys = sorted({y for c in contornos for _, y in c})
    verticais = [(c[k - 1], c[k]) for c in contornos for k in range(len(c)) if c[k - 1][0] == c[k][0]]

    def dentro(px, py):  # par-ímpar: conta os furos
        cruzamentos = sum(1 for (x0, y0), (_, y1) in verticais if x0 > px and (y0 > py) != (y1 > py))
        return cruzamentos % 2 == 1

    nx, ny = len(xs) - 1, len(ys) - 1
    cheio = [[dentro((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2) for j in range(ny)] for i in range(nx)]
    menor = math.inf
    for i in range(nx):
        for j in range(ny):
            if not cheio[i][j]:
                continue
            a = b = i
            while a > 0 and cheio[a - 1][j]:
                a -= 1
            while b < nx - 1 and cheio[b + 1][j]:
                b += 1
            c = d = j
            while c > 0 and cheio[i][c - 1]:
                c -= 1
            while d < ny - 1 and cheio[i][d + 1]:
                d += 1
            menor = min(menor, xs[b + 1] - xs[a], ys[d + 1] - ys[c])
    return menor


def arredondar(contorno, raio, segmentos=10):
    """Troca cada canto por um quarto de círculo de raio `raio` (0 = canto vivo)."""
    if raio <= 0:
        return list(contorno)
    n = len(contorno)
    pontos = []
    for k in range(n):
        ax, ay = contorno[k - 1]
        bx, by = contorno[k]
        cx, cy = contorno[(k + 1) % n]
        l1 = math.hypot(bx - ax, by - ay)
        l2 = math.hypot(cx - bx, cy - by)
        r = min(raio, l1 / 2, l2 / 2)
        d1 = ((bx - ax) / l1, (by - ay) / l1)
        d2 = ((cx - bx) / l2, (cy - by) / l2)
        p1 = (bx - d1[0] * r, by - d1[1] * r)
        p2 = (bx + d2[0] * r, by + d2[1] * r)
        centro = (p1[0] + d2[0] * r, p1[1] + d2[1] * r)
        a1 = math.atan2(p1[1] - centro[1], p1[0] - centro[0])
        a2 = math.atan2(p2[1] - centro[1], p2[0] - centro[0])
        delta = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for t in range(segmentos + 1):
            a = a1 + delta * t / segmentos
            pontos.append((centro[0] + r * math.cos(a), centro[1] + r * math.sin(a)))
    limpos = []
    for p in pontos:
        if not limpos or math.hypot(p[0] - limpos[-1][0], p[1] - limpos[-1][1]) > 1e-7:
            limpos.append(p)
    if math.hypot(limpos[0][0] - limpos[-1][0], limpos[0][1] - limpos[-1][1]) <= 1e-7:
        limpos.pop()
    return limpos


# ---------------------------------------------------------------------------
# Famílias: cada uma devolve peças {somar, cortar, tom} na sua grelha
# ---------------------------------------------------------------------------


def _peca(somar, tom="B", cortar=()):
    return {"somar": list(somar), "cortar": list(cortar), "tom": tom}


def fiada(p):
    """Tijolos em fiadas, as fiadas ímpares desencontradas de `desencontro` × tijolo.

    `pecas` escolhe as fiadas (de baixo para cima): 3 = 2 + 1, 4 = 2 + 2.
    `proporcao` é o comprimento do tijolo em alturas. O tijolo claro é o
    último assente: o de cima, mais à direita.
    """
    fiadas = {3: [2, 1], 4: [2, 2], 5: [2, 1, 2], 6: [2, 2, 2]}[p["pecas"]]
    comprimento = p["proporcao"]
    desvio = p["desencontro"] * comprimento
    pecas = []
    for j, n in enumerate(fiadas):
        x = desvio if j % 2 else 0.0
        for i in range(n):
            pecas.append(_peca([(x + i * comprimento, j, x + (i + 1) * comprimento, j + 1)]))
    pecas[-1]["tom"] = "L"
    return pecas


def escada(p):
    """Um tijolo por fiada, cada fiada desencontrada da de baixo: uma escada.

    O tijolo claro é o de cima.
    """
    comprimento = p["proporcao"]
    desvio = p["desencontro"] * comprimento
    pecas = [_peca([(j * desvio, j, j * desvio + comprimento, j + 1)]) for j in range(p["pecas"])]
    pecas[-1]["tom"] = "L"
    return pecas


def cata_vento(p):
    """Quatro tijolos à volta do centro, cada um a encostar ao topo do seguinte.

    `proporcao` é o comprimento do braço em larguras. Com `vazio` o centro fica
    aberto (um quadrado de lado proporção − 1); sem ele o centro é uma quinta
    peça, e é essa a clara. Com vazio, o claro é o braço de cima.
    """
    a = p["proporcao"]
    pecas = [
        _peca([(0, 0, a, 1)]),  # baixo
        _peca([(a, 0, a + 1, a)]),  # direita
        _peca([(1, a, a + 1, a + 1)]),  # cima
        _peca([(0, 1, 1, a + 1)]),  # esquerda
    ]
    if p["vazio"]:
        pecas[2]["tom"] = "L"
    else:
        pecas.append(_peca([(1, 1, a, a)], "L"))
    return pecas


def encaixe_l(p):
    """Duas peças que fecham um quadrado: um L claro e o que falta, escuro.

    `proporcao` é a espessura do braço, em fração do lado. Sem `vazio`, o que
    falta é um bloco no canto do L; com vazio, é outro L, virado ao contrário,
    e fica um furo quadrado no meio.
    """
    t = p["proporcao"]
    if p["vazio"]:
        l_claro = _peca([(0, 0, t, 1 - t), (0, 0, 1, t)], "L")
        resto = _peca([(1 - t, t, 1, 1), (0, 1 - t, 1, 1)], "B")
    else:
        l_claro = _peca([(0, 0, t, 1), (0, 0, 1, t)], "L")
        resto = _peca([(t, t, 1, 1)], "B")
    return [l_claro, resto]


def dentado(p):
    """Tijolos empilhados, cada um com um dente que encaixa no de baixo.

    O dente mede um terço do tijolo e metade da altura; `desencontro` diz onde
    fica o centro do dente, em fração do comprimento, alternando de lado de
    junta para junta. `proporcao` é o comprimento do tijolo em alturas. O
    tijolo claro é o de cima.
    """
    comprimento = p["proporcao"]
    largura_dente = comprimento / 3
    fundura = 0.5
    n = p["pecas"]
    pecas = [_peca([(0, j, comprimento, j + 1)]) for j in range(n)]
    for j in range(n - 1):
        o = p["desencontro"] if j % 2 == 0 else 1 - p["desencontro"]
        xc = o * comprimento
        dente = (xc - largura_dente / 2, j + 1 - fundura, xc + largura_dente / 2, j + 1)
        pecas[j + 1]["somar"].append(dente)
        pecas[j]["cortar"].append(dente)
    pecas[-1]["tom"] = "L"
    return pecas


def moldura(p):
    """A família do símbolo atual: pilar e retângulos, com ou sem a moldura.

    Com `moldura`, um aro de traço final 13 (o do docs/marca/README.md) à
    volta do campo, com o mesmo vão das peças. `pecas` conta só o que está
    dentro: 3 = pilar e dois retângulos (a composição atual); 2 = pilar e um
    retângulo. O retângulo de baixo é o claro, como na marca atual.
    """
    g = p["espacamento"]
    recuo_total = 100 * g / (100 + g)  # o que o recuo das juntas tira ao traço
    traco = 13 * (100 - recuo_total) / 100 + recuo_total if p["moldura"] else 0.0
    a, b = traco, 100 - traco
    pilar = a + 0.25 * (b - a)
    pecas = []
    if p["moldura"]:
        pecas.append(_peca([(0, 0, 100, 100)], "B", cortar=[(a, a, b, b)]))
    pecas.append(_peca([(a, a, pilar, b)], "B"))
    if p["pecas"] == 3:
        meio = (a + b) / 2
        pecas.append(_peca([(pilar, meio, b, b)], "B"))
        pecas.append(_peca([(pilar, a, b, meio)], "L"))
    elif p["pecas"] == 2:
        pecas.append(_peca([(pilar, a, b, b)], "L"))
    else:
        raise ValueError("a moldura tem 2 ou 3 peças lá dentro")
    return pecas


def haste_e_bojo(p):
    """Uma haste alta e um bojo quadrado encostado ao pé dela: lê-se como um b.

    `proporcao` é a altura da haste em lados do bojo. Com `vazio` o bojo tem
    um furo quadrado no meio. `tom_claro` diz qual das duas peças é a clara.
    """
    lado = 3
    haste = _peca([(0, 0, 1, lado * p["proporcao"])])
    bojo = _peca([(1, 0, 1 + lado, lado)], cortar=[(2, 1, 3, 2)] if p["vazio"] else [])
    if p["tom_claro"] == "haste":
        haste["tom"] = "L"
    elif p["tom_claro"] == "bojo":
        bojo["tom"] = "L"
    else:
        raise ValueError("tom_claro é 'haste' ou 'bojo'")
    return [haste, bojo]


FAMILIAS = {
    "fiada": (fiada, {"pecas", "proporcao", "desencontro"}),
    "escada": (escada, {"pecas", "proporcao", "desencontro"}),
    "cata_vento": (cata_vento, {"proporcao", "vazio"}),
    "encaixe_l": (encaixe_l, {"proporcao", "vazio"}),
    "dentado": (dentado, {"pecas", "proporcao", "desencontro"}),
    "moldura": (moldura, {"pecas", "moldura"}),
    "haste_e_bojo": (haste_e_bojo, {"proporcao", "vazio", "tom_claro"}),
}
COMUNS = {"espacamento", "raio", "rotacao"}


# ---------------------------------------------------------------------------
# De peças a desenho: rodar, contornar, normalizar, abrir juntas, arredondar
# ---------------------------------------------------------------------------


def _arredonda_coord(r):
    return tuple(round(v, 9) + 0.0 for v in r)


def construir(pecas, espacamento, raio, rotacao):
    """Peças da grelha da família -> peças finais na grelha de 100."""
    contornadas = []
    for peca in pecas:
        somar = [_arredonda_coord(rodar_retangulo(r, rotacao)) for r in peca["somar"]]
        cortar = [_arredonda_coord(rodar_retangulo(r, rotacao)) for r in peca["cortar"]]
        contornadas.append((peca["tom"], contornar(somar, cortar)))

    exteriores = [c[0] for _, c in contornadas]
    x0 = min(x for c in exteriores for x, _ in c)
    y0 = min(y for c in exteriores for _, y in c)
    x1 = max(x for c in exteriores for x, _ in c)
    y1 = max(y for c in exteriores for _, y in c)
    escala = 100 / max(x1 - x0, y1 - y0)
    largura, altura = (x1 - x0) * escala, (y1 - y0) * escala

    # Recuar metade do vão encolhe a marca de um vão; voltar a escalar para 100
    # alarga o vão na mesma razão. d = 50 g / (100 + g) dá o vão final exato.
    d = 50 * espacamento / (100 + espacamento)
    fator = 100 / (100 - 2 * d)
    cx, cy = largura / 2, altura / 2

    finais = []
    for tom, contornos in contornadas:
        novos = []
        for c in contornos:
            c = [((x - x0) * escala, (y - y0) * escala) for x, y in c]
            c = recuar(c, d) if d > 0 else c
            c = [(cx + (x - cx) * fator, cy + (y - cy) * fator) for x, y in c]
            novos.append(c)
        finais.append((tom, novos))

    nx0 = min(x for _, cs in finais for x, _ in cs[0])
    ny0 = min(y for _, cs in finais for _, y in cs[0])
    pecas_finais = []
    for tom, contornos in finais:
        pecas_finais.append(
            {
                "tom": tom,
                "espessura": espessura_minima(contornos),
                "contornos": [arredondar([(x - nx0, y - ny0) for x, y in c], raio) for c in contornos],
            }
        )
    largura_final = max(x for p in pecas_finais for x, _ in p["contornos"][0])
    altura_final = max(y for p in pecas_finais for _, y in p["contornos"][0])
    return pecas_finais, largura_final, altura_final


def referencia():
    """O símbolo atual (docs/marca/bricklap-logo.svg), com as medidas dele.

    Não sai do varrimento e não obedece à regra do raio único: a moldura tem
    raio 20 por fora e 7 por dentro, e as peças 3. Está aqui só para se
    comparar com as variantes ao mesmo tamanho e no mesmo render.
    """

    def ret(x0, y0, x1, y1):  # coordenadas do SVG (y para baixo) -> y para cima
        return [(x0, 100 - y1), (x1, 100 - y1), (x1, 100 - y0), (x0, 100 - y0)]

    furo = list(reversed(ret(13, 13, 87, 87)))
    pecas = [
        {"tom": "B", "espessura": 13, "contornos": [arredondar(ret(0, 0, 100, 100), 20), arredondar(furo, 7)]},
        {"tom": "B", "espessura": 13, "contornos": [arredondar(ret(19, 19, 32, 81), 3)]},
        {"tom": "B", "espessura": 28.5, "contornos": [arredondar(ret(37, 19, 81, 47.5), 3)]},
        {"tom": "L", "espessura": 28.5, "contornos": [arredondar(ret(37, 52.5, 81, 81), 3)]},
    ]
    return {
        "id": "REF",
        "familia": "REF",
        "nome": "símbolo atual",
        "parametros": {"espacamento": 5},
        "variacao": {},
        "pecas": pecas,
        "largura": 100.0,
        "altura": 100.0,
    }


def variantes(parametros):
    """Todas as variantes do varrimento, pela ordem das famílias e dos eixos."""
    saida = []
    ids = set()
    for fam in parametros["familias"]:
        funcao, proprios = FAMILIAS[fam["nome"]]
        nomes = [eixo[0] for eixo in fam["eixos"]]
        valores = [eixo[1] for eixo in fam["eixos"]]
        for indices in itertools.product(*[range(len(v)) for v in valores]):
            p = dict(fam["fixos"])
            p.update({nome: valores[k][i] for k, (nome, i) in enumerate(zip(nomes, indices))})
            desconhecidos = set(p) - proprios - COMUNS
            if desconhecidos:
                raise ValueError(f"{fam['nome']} não usa {sorted(desconhecidos)}")
            faltam = (proprios | COMUNS) - set(p)
            if faltam:
                raise ValueError(f"{fam['nome']} precisa de {sorted(faltam)}")
            ident = fam["letra"] + "".join(str(i + 1) for i in indices)
            if ident in ids:
                raise ValueError(f"id repetido: {ident}")
            ids.add(ident)
            pecas, largura, altura = construir(funcao(p), p["espacamento"], p["raio"], p["rotacao"])
            saida.append(
                {
                    "id": ident,
                    "familia": fam["letra"],
                    "nome": fam["nome"],
                    "parametros": p,
                    "variacao": {nome: p[nome] for nome in nomes},
                    "pecas": pecas,
                    "largura": largura,
                    "altura": altura,
                }
            )
    return saida


if __name__ == "__main__":
    with open(sys.argv[1] if len(sys.argv) > 1 else "parametros.json", encoding="utf-8") as f:
        todas = variantes(json.load(f))
    for v in [referencia()] + todas:
        tons = "".join(p["tom"] for p in v["pecas"])
        furos = sum(len(p["contornos"]) - 1 for p in v["pecas"])
        fina = min(p["espessura"] for p in v["pecas"])
        print(f"{v['id']:5} {v['nome']:13} {len(v['pecas'])} peças ({tons}) {furos} furos "
              f"{v['largura']:6.2f} × {v['altura']:6.2f}  mais fina {fina:5.2f} = {fina * 0.24:4.2f} px a 24  "
              f"{v['variacao']}")
    print(f"{len(todas)} variantes")
