"""
Os doze conceitos da sessão 19b: repertório novo, fora da geométrica abstrata.

Python puro, como o sementes.py, de quem herda a grelha: a grelha de 24 do
CTO, em coordenadas do SVG (y para baixo), com a tinta dentro de 2..22 (a
área viva do icon-design.md). A 24 px uma unidade é um píxel.

O que muda face à sessão 19, e vem do icon-design.md:

  - coordenadas inteiras: todas as arestas retas da construção caem num
    píxel inteiro a 24 px (verificado, não suposto — `alinhada`);
  - cantos pela tabela da skill: raio 1 numa peça com menos de 8 de
    espessura, 2 a partir de 8, e os cantos interiores (côncavos) a 0.

Cada conceito é uma função que recebe os parâmetros e devolve peças. Uma peça
é {"nome", "tom", "somar": [retângulos]}; um retângulo é (x0, y0, x1, y1) na
grelha de 24. O tom "L" é o claro (#E89478), o "B" o escuro (#C0402C).

O repertório e as categorias estão no relatório da sessão 19b (§2), escritos
antes deste ficheiro.
"""

import json
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import familias  # noqa: E402
import sementes  # noqa: E402

GRELHA = 24


def _peca(nome, tom, *retangulos):
    return {"nome": nome, "tom": tom, "somar": [tuple(float(v) for v in r) for r in retangulos]}


# ---------------------------------------------------------------------------
# (b) espaço negativo e dupla leitura
# ---------------------------------------------------------------------------


def l_na_junta(p):
    """J. Um tijolo partido por uma junta em L: a letra é a junta.

    Uma peça em L por fora (haste e pé, espessura `t`) e um bloco por dentro,
    com a junta `c` entre os dois, aberta nas duas pontas. `bloco` quadrado
    enche a caixa de 18; `alto` faz do bloco um tijolo ao alto (1:2), e a
    caixa fica estreita, com as proporções de um L de letra.
    """
    t, c = p["t"], p["c"]
    y0, y1 = 3, 21
    if p["bloco"] == "quadrado":
        x0, x1 = 3, 21
    elif p["bloco"] == "alto":
        largura = t + c + (y1 - y0 - t - c) // 2
        x0 = math.floor(GRELHA / 2 - largura / 2)
        x1 = x0 + largura
    else:
        raise ValueError("o bloco da J é 'quadrado' ou 'alto'")
    return [
        _peca("L de fora", "B", (x0, y0, x0 + t, y1), (x0 + t, y1 - t, x1, y1)),
        _peca("bloco", "L", (x0 + t + c, y0, x1, y1 - t - c)),
    ]


def cama_de_argamassa(p):
    """H. A J com a junta alargada até ser uma letra grossa (SCAMPER: modificar).

    A peça de fora é fina (`t`), o vão em L é largo (`c`), e o bloco enche o
    resto da caixa de 18.
    """
    t, c = p["t"], p["c"]
    return [
        _peca("L de fora", "B", (3, 3, 3 + t, 21), (3 + t, 21 - t, 21, 21)),
        _peca("bloco", "L", (3 + t + c, 3, 21, 21 - t - c)),
    ]


def esquina_aberta(p):
    """K. A J sem o canto de fora: o L de fundo fecha-se pelo olho (SCAMPER: adaptar).

    Duas barras (haste e pé, espessura `t`) que não se encontram, e o bloco.
    O vão em L tem largura `c`; o canto de fora fica aberto num quadrado de
    lado t + c, e `e` encurta ainda mais as duas barras.
    """
    t, c, e = p["t"], p["c"], p["e"]
    return [
        _peca("haste", "B", (3, 3, 3 + t, 21 - t - c - e)),
        _peca("pé", "B", (3 + t + c + e, 21 - t, 21, 21)),
        _peca("bloco", "L", (3 + t + c, 3, 21, 21 - t - c)),
    ]


def l_de_luz(p):
    """T. Três peças encaixadas; a do meio é um L no tom claro (SCAMPER: combinar).

    Por fora um L escuro de espessura 3, no meio o L claro de espessura `m`,
    por dentro um bloco escuro, com juntas `c`. Sobre o creme o L claro quase
    vale como fundo, entre duas peças escuras; sobre o escuro é a figura mais
    clara.
    """
    m, c = p["m"], p["c"]
    x = 6 + c  # onde começa o L do meio
    y = 18 - c  # onde acaba o L do meio, em baixo
    return [
        _peca("L de fora", "B", (3, 3, 6, 21), (6, 18, 21, 21)),
        _peca("L de luz", "L", (x, 3, x + m, y), (x + m, y - m, 21, y)),
        _peca("bloco", "B", (x + m + c, 3, 21, y - m - c)),
    ]


# ---------------------------------------------------------------------------
# (a) letra + metáfora
# ---------------------------------------------------------------------------


def cunhal(p):
    """U. O L como a esquina de uma parede em planta, de tijolos com juntas.

    Espessura `t`, juntas de 2, o canto é do pé (a leitura L da sessão 19).
    O tijolo do canto mede 2t + 2, como um tijolo real de largura t; o resto
    do pé é o segundo tijolo. `partido` = "pé" parte só o pé (três peças);
    "haste e pé" parte também a haste ao meio (quatro peças).
    """
    t = p["t"]
    fundo_haste = 21 - t - 2
    canto = 3 + 2 * t + 2
    pecas = [
        _peca("pé, canto", "L", (3, 21 - t, canto, 21)),
        _peca("pé, fim", "L", (canto + 2, 21 - t, 21, 21)),
    ]
    if p["partido"] == "pé":
        pecas.insert(0, _peca("haste", "B", (3, 3, 3 + t, fundo_haste)))
    elif p["partido"] == "haste e pé":
        meio = (3 + fundo_haste - 2) // 2
        pecas.insert(0, _peca("haste, baixo", "B", (3, meio + 2, 3 + t, fundo_haste)))
        pecas.insert(0, _peca("haste, cima", "B", (3, 3, 3 + t, meio)))
    else:
        raise ValueError("a U parte o 'pé' ou a 'haste e pé'")
    return pecas


def curva_da_pista(p):
    """Q. Duas pistas paralelas a dobrar em ângulo reto (SCAMPER: substituir).

    Largura de pista `w`, junta de 2 entre as pistas. `d` escalona as
    partidas: a pista de dentro começa e acaba `d` mais à frente, como as
    partidas desencontradas de uma pista de atletismo.
    """
    w, d = p["w"], p["d"]
    x = 3 + w + 2
    y = 21 - w - 2
    return [
        _peca("pista de fora", "B", (3, 3, 3 + w, 21), (3 + w, 21 - w, 21, 21)),
        _peca("pista de dentro", "L", (x, 3 + d, x + w, y), (x + w, y - w, 21 - d, y)),
    ]


def l_em_aparelho(p):
    """A. A haste assenta desencontrada meia peça sobre o pé, como um tijolo sobre a junta.

    Espessura `t` nas duas peças, junta de 2, desencontro t // 2. `lado` =
    "fora": a haste sai para a esquerda do pé; "dentro": a haste recolhe e o
    pé sai para a esquerda dela.
    """
    t = p["t"]
    o = t // 2
    fundo = 21 - t - 2
    if p["lado"] == "fora":
        return [_peca("haste", "B", (3, 3, 3 + t, fundo)), _peca("pé", "L", (3 + o, 21 - t, 21, 21))]
    if p["lado"] == "dentro":
        return [_peca("haste", "B", (3 + o, 3, 3 + o + t, fundo)), _peca("pé", "L", (3, 21 - t, 21, 21))]
    raise ValueError("o lado da A é 'fora' ou 'dentro'")


def blocos_que_encaixam(p):
    """X. O L de blocos quadrados iguais: três na haste e `pe` no pé.

    Lado do bloco `a`, juntas de 2. Com um bloco no pé é a peça em L que se
    encaixa numa pilha de blocos; com dois, o pé fica mais comprido. A caixa
    centra-se na grelha pelo píxel inteiro.
    """
    a, n = p["a"], p["pe"]
    altura = 3 * a + 4
    largura = (1 + n) * a + 2 * n
    x0 = math.floor(GRELHA / 2 - largura / 2)
    y0 = math.floor(GRELHA / 2 - altura / 2)
    pecas = [_peca(f"haste {k + 1}", "B", (x0, y0 + k * (a + 2), x0 + a, y0 + k * (a + 2) + a)) for k in range(3)]
    base = y0 + 2 * (a + 2)
    pecas += [_peca(f"pé {j}", "L", (x0 + j * (a + 2), base, x0 + j * (a + 2) + a, base + a)) for j in range(1, n + 1)]
    return pecas


# ---------------------------------------------------------------------------
# (d) símbolo icónico simplificado
# ---------------------------------------------------------------------------


def sapatilha(p):
    """S. A sapatilha de perfil em ângulo reto: cano, sola e biqueira.

    Cano 5 × 11 ao alto, sola 18 × 5 deitada, junta de 2. A biqueira mede
    5 de comprido e `h` de altura, na ponta da sola: `biqueira` = "na sola"
    faz dela parte da sola (uma peça com a ponta levantada); "à parte" pousa-a
    em cima da sola, com uma junta.
    """
    h = p["h"]
    cano = _peca("cano", "B", (3, 3, 8, 14))
    if p["biqueira"] == "na sola":
        return [cano, _peca("sola", "L", (3, 16, 21, 21), (16, 16 - h, 21, 16))]
    if p["biqueira"] == "à parte":
        return [cano, _peca("sola", "L", (3, 16, 21, 21)), _peca("biqueira", "B", (16, 14 - h, 21, 14))]
    raise ValueError("a biqueira da S é 'na sola' ou 'à parte'")


def remo_indoor(p):
    """R. O ergómetro de perfil: volante ao alto, carril deitado e o banco.

    Carril 18 × 3, volante com 6 de largura, banco 5 × 3 pousado no carril,
    juntas de 2. `torre` alta ou baixa; `banco` a meio do carril ou na ponta.
    """
    topo = {"alta": 3, "baixa": 8}[p["torre"]]
    x = {"meio": 11, "ponta": 16}[p["banco"]]
    return [
        _peca("volante", "B", (3, topo, 9, 16)),
        _peca("banco", "B", (x, 13, x + 5, 16)),
        _peca("carril", "L", (3, 18, 21, 21)),
    ]


def barra_e_disco(p):
    """W. O disco ao alto e a barra deitada, de perfil.

    Disco com 6 de largura, barra 10 × 3 ao lado dele, junta de 2. `barra`
    no "chão" (rente à base do disco) ou no "eixo" (à altura do centro do
    disco); `disco` "alto" (18) ou "baixo" (14).
    """
    topo = {"alto": 3, "baixo": 7}[p["disco"]]
    if p["barra"] == "chão":
        y = 18
    elif p["barra"] == "eixo":
        y = (topo + 21) // 2 - 1
    else:
        raise ValueError("a barra da W fica no 'chão' ou no 'eixo'")
    return [_peca("disco", "B", (3, topo, 9, 21)), _peca("barra", "L", (11, y, 21, y + 3))]


# ---------------------------------------------------------------------------
# (c) geométrica abstrata
# ---------------------------------------------------------------------------


def l_otico(p):
    """O. A P2122 com a correção ótica do icon-design.md.

    "Uma linha horizontal parece mais leve do que uma vertical com as mesmas
    medidas": o pé engrossa face à haste. Na caixa da P (x 4..21, y 3..21),
    canto no pé, junta de 2; haste `h`, pé h + `dp`.
    """
    h, pe = p["h"], p["h"] + p["dp"]
    return [_peca("haste", "B", (4, 3, 4 + h, 21 - pe - 2)), _peca("pé", "L", (4, 21 - pe, 21, 21))]


CONCEITOS = {
    "l_na_junta": l_na_junta,
    "cama_de_argamassa": cama_de_argamassa,
    "esquina_aberta": esquina_aberta,
    "l_de_luz": l_de_luz,
    "cunhal": cunhal,
    "curva_da_pista": curva_da_pista,
    "l_em_aparelho": l_em_aparelho,
    "blocos_que_encaixam": blocos_que_encaixam,
    "sapatilha": sapatilha,
    "remo_indoor": remo_indoor,
    "barra_e_disco": barra_e_disco,
    "l_otico": l_otico,
}


# ---------------------------------------------------------------------------
# Medidas da construção: alinhamento, junta, recorte
# ---------------------------------------------------------------------------


def alinhada(pecas):
    """Todas as coordenadas dos retângulos são inteiras na grelha de 24."""
    return all(float(v).is_integer() for peca in pecas for r in peca["somar"] for v in r)


def junta_minima(pecas):
    """O vão mais estreito entre duas peças diferentes, na grelha de 24 (= px a 24)."""
    menor = math.inf
    for i, a in enumerate(pecas):
        for b in pecas[i + 1 :]:
            for ax0, ay0, ax1, ay1 in a["somar"]:
                for bx0, by0, bx1, by1 in b["somar"]:
                    dx = max(0.0, bx0 - ax1, ax0 - bx1)
                    dy = max(0.0, by0 - ay1, ay0 - by1)
                    if dx == 0 and dy == 0:
                        raise ValueError(f"as peças {a['nome']} e {b['nome']} tocam-se")
                    menor = min(menor, math.hypot(dx, dy))
    return menor


def raio_da_peca(espessura):
    """A tabela do icon-design.md: raio 1 abaixo de 8, raio 2 a partir de 8."""
    return 2 if espessura >= 8 else 1


def arredondar_convexos(contorno, raio, segmentos=10):
    """Arredonda só os cantos convexos; os interiores ficam a 0 (icon-design.md).

    Os contornos do familias.contornar deixam a região à esquerda de quem os
    percorre: um canto é convexo quando se vira à esquerda.
    """
    n = len(contorno)
    pontos = []
    for k in range(n):
        ax, ay = contorno[k - 1]
        bx, by = contorno[k]
        cx, cy = contorno[(k + 1) % n]
        if (bx - ax) * (cy - by) - (by - ay) * (cx - bx) <= 0:
            pontos.append((bx, by))
            continue
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
        for s in range(segmentos + 1):
            a = a1 + delta * s / segmentos
            pontos.append((centro[0] + r * math.cos(a), centro[1] + r * math.sin(a)))
    return pontos


def construir(pecas):
    """Peças na grelha de 24 (y para baixo) -> peças do gerar.py (grelha de 100, y para cima)."""
    escala = 100 / GRELHA
    finais = []
    for peca in pecas:
        contornos = familias.contornar(peca["somar"])
        espessura = familias.espessura_minima(contornos)
        raio = raio_da_peca(espessura)
        redondos = [arredondar_convexos(c, raio) for c in contornos]
        finais.append(
            {
                "nome": peca["nome"],
                "tom": peca["tom"],
                "espessura": espessura * escala,
                "espessura24": espessura,
                "raio24": raio,
                "contornos": [[(x * escala, (GRELHA - y) * escala) for x, y in c] for c in redondos],
            }
        )
    return finais


def variantes(parametros):
    circulo = parametros["recorte"]["raio_na_grelha"]
    saida, ids = [], set()
    for con in parametros["conceitos"]:
        funcao = CONCEITOS[con["funcao"]]
        nomes = [eixo[0] for eixo in con["eixos"]]
        valores = [eixo[1] for eixo in con["eixos"]]
        indices = [[]]
        for v in valores:
            indices = [prefixo + [i] for prefixo in indices for i in range(len(v))]
        for combinacao in indices:
            p = dict(con.get("fixos", {}))
            p.update({nome: valores[k][i] for k, (nome, i) in enumerate(zip(nomes, combinacao))})
            ident = con["letra"] + "".join(str(i + 1) for i in combinacao)
            if ident in ids:
                raise ValueError(f"id repetido: {ident}")
            ids.add(ident)
            pecas = funcao(p)
            perda, perna = sementes.perda_no_circulo(pecas, circulo)
            saida.append(
                {
                    "id": ident,
                    "familia": con["letra"],
                    "nome": con["nome"],
                    "categoria": con["categoria"],
                    "letra_em": con["letra_em"],
                    "parametros": p,
                    "variacao": {nome: p[nome] for nome in nomes},
                    "construcao": pecas,
                    "pecas": construir(pecas),
                    "largura": 100.0,
                    "altura": 100.0,
                    "alinhada": alinhada(pecas),
                    "junta": junta_minima(pecas),
                    "recorte": {"perda": perda, "peca": perna},
                }
            )
    return saida


def referencias(circulo):
    """Fora da contagem: o símbolo atual, e a P2122 e a P2121 com o código da sessão 19."""
    ref = familias.referencia()
    ref.update({"recorte": None, "junta": 1.2, "alinhada": False, "categoria": "—", "letra_em": []})
    saida = [ref]
    for ident, raio in (("P2122", 1), ("P2121", 0)):
        p = {"espessura": 5, "junta": 2, "desencontro": 1, "raio": raio}
        v = sementes._variante(ident, "P", "L de duas peças", p, dict(p), sementes.pecas_em_l(p), circulo)
        pecas = sementes.pecas_em_l(p)
        for final, peca, nome in zip(v["pecas"], pecas, ("haste", "pé")):
            final["nome"] = nome
            final["espessura24"] = final["espessura"] * GRELHA / 100
            peca["nome"] = nome
        v.update({"categoria": "(c)", "letra_em": ["pé"], "construcao": pecas, "alinhada": alinhada(pecas)})
        saida.append(v)
    return saida


if __name__ == "__main__":
    caminho = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "parametros-sessao-19b.json")
    with open(caminho, encoding="utf-8") as f:
        parametros = json.load(f)
    todas = variantes(parametros)
    for v in referencias(parametros["recorte"]["raio_na_grelha"]) + todas:
        tons = "".join(p["tom"] for p in v["pecas"])
        fina = min(p["espessura"] for p in v["pecas"]) * GRELHA / 100
        corte = v["recorte"]
        perda = f"{corte['perda'] * 100:4.1f} %" if corte else "  —  "
        print(
            f"{v['id']:6} {v['categoria']:4} {len(v['pecas'])} peças ({tons:4}) fina {fina:4.1f} "
            f"junta {v['junta']:4.2f} alinhada {'sim' if v['alinhada'] else 'não'} perna {perda}  {v['variacao']}"
        )
    por_categoria = {}
    for v in todas:
        por_categoria[v["categoria"]] = por_categoria.get(v["categoria"], 0) + 1
    print(f"{len(todas)} variantes: {por_categoria}")
