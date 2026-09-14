"""
Fábrica de silhuetas, sessão 19b: o repertório novo, medido com a régua congelada.

Corre dentro do Blender, sem interface, pelo gerar.sh:

    tools/marca-blender/gerar.sh --sessao 19b [pasta]

Reutiliza o gerar.py da 18 (a cena plana, a folha, as regiões conexas) e o
sessao19.py da 19 (os materiais dos dois temas, as medidas por tema, o
recorte), com os conceitos de repertorio.py. O que acrescenta:

  - critério 4, o alinhamento à grelha de 24, e o 5, o desfoque (peso e
    mancha a 24 px, com uma folha desfocada);
  - o contraste WCAG de cada peça sobre cada tema, e o passo 4: a P2122 e a
    P2121 em quatro colorações.

Folhas: folha-24px.png (todas, creme e escuro, só com os ids),
folha-medicao.png (73, 48 e 24 px, com a descrição), folha-desfoque.png,
folha-73px-aprovadas.png, folha-recorte-aprovadas.png e folha-contraste.png.
Tabelas em medidas.md e contraste.md; tudo em medidas.json.
"""

import argparse
import colorsys
import json
import math
import os
import sys
import time

import bpy
import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gerar  # noqa: E402
import repertorio  # noqa: E402
import sessao19  # noqa: E402

TEMAS = sessao19.TEMAS


def _num(valor, casas=2):
    return f"{valor:.{casas}f}".rstrip("0").rstrip(".").replace(".", ",")


def descricao(v):
    if v["id"] == "REF":
        return "o símbolo atual (docs/marca)"
    if v["id"] in ("P2122", "P2121"):
        return f"a candidata da sessão 19, raio {v['parametros']['raio']}"
    return " · ".join(f"{k} {_num(x) if isinstance(x, (int, float)) else x}" for k, x in v["variacao"].items())


# ---------------------------------------------------------------------------
# Cor: contraste WCAG 2.1, o tom claro escurecido, a distância entre tons
# ---------------------------------------------------------------------------


def luminancia(hexa):
    canais = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in gerar.hexa_para_srgb(hexa)]
    return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2]


def contraste(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def para_hexa(rgb):
    return "#" + "".join(f"{round(c * 255):02X}" for c in rgb)


def matiz(hexa):
    h, _, _ = colorsys.rgb_to_hls(*gerar.hexa_para_srgb(hexa))
    return h * 360


def escurecer_ate(hexa, fundo, limiar):
    """O tom com o matiz e a saturação HSL de `hexa`, e a maior luminosidade que dá `limiar` sobre `fundo`."""
    h, l_, s = colorsys.rgb_to_hls(*gerar.hexa_para_srgb(hexa))
    passo = 0.0005
    while l_ > 0:
        candidato = para_hexa(colorsys.hls_to_rgb(h, l_, s))
        if contraste(candidato, fundo) >= limiar:
            return candidato
        l_ -= passo
    raise ValueError("não há tom que chegue ao limiar")


def lab(hexa):
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in gerar.hexa_para_srgb(hexa)]
    x = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047
    y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883
    f = [t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116 for t in (x, y, z)]
    return (116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2]))


def delta_e(a, b):
    return math.dist(lab(a), lab(b))


def contraste_da_variante(v, cores):
    """Por tema: o contraste da peça que faz a letra e o da peça mais fraca."""
    tons = {p["nome"]: p["tom"] for p in v["pecas"] if "nome" in p}
    letra_em = v.get("letra_em") or []
    if letra_em == "fundo":
        da_letra = set(tons.values())
    else:
        da_letra = {tons[n] for n in letra_em if n in tons}
    todos = {p["tom"] for p in v["pecas"]}
    saida = {}
    for tema in TEMAS:
        valor = {t: contraste(cores[t], cores[tema]) for t in todos}
        saida[tema] = {
            "letra": min(valor[t] for t in da_letra) if da_letra else None,
            "mais_fraca": min(valor.values()),
        }
    return saida


# ---------------------------------------------------------------------------
# Desfoque: peso e mancha a 24 px, a uma cor sobre o creme
# ---------------------------------------------------------------------------


def gaussiana(matriz, sigma):
    raio = int(math.ceil(3 * sigma))
    x = np.arange(-raio, raio + 1)
    k = np.exp(-(x**2) / (2 * sigma**2))
    k /= k.sum()
    pad = np.pad(matriz, raio)
    linhas = np.apply_along_axis(lambda r: np.convolve(r, k, mode="same"), 1, pad)
    cols = np.apply_along_axis(lambda c: np.convolve(c, k, mode="same"), 0, linhas)
    return cols[raio:-raio, raio:-raio]


def cobertura_uma_cor(recorte, cores):
    (k,) = sessao19.cobertura(recorte, cores["creme"], [cores["uma_cor_creme"]])
    return np.clip(k, 0, 1)


def medir_desfoque(imagem, folha, cores, sigma):
    """{id: {"peso", "mancha", "cobertura"}} a partir das caixas de 24 px, uma cor, creme."""
    saida = {}
    for caixa in folha.caixas:
        if caixa["tamanho"] != 24 or caixa.get("tema") != "creme" or not caixa["uma_cor"]:
            continue
        recorte = imagem[caixa["y"] : caixa["y"] + 24, caixa["x"] : caixa["x"] + 24]
        c = cobertura_uma_cor(recorte, cores)
        # a mancha mede-se com folga à volta: a gaussiana espalha tinta para fora da caixa
        folga = np.pad(c, 8)
        saida[caixa["id"]] = {"peso": float(c.mean()), "mancha": float(gaussiana(folga, sigma).max()), "cobertura": c}
    return saida


def gravar_png(caminho, rgb):
    """Uma imagem (altura, largura, 3) em 0..255, de cima para baixo, gravada tal e qual."""
    altura, largura, _ = rgb.shape
    imagem = bpy.data.images.new("composta", largura, altura, alpha=False)
    imagem.colorspace_settings.name = "Non-Color"
    rgba = np.ones((altura, largura, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(rgb, 0, 255)[::-1] / 255
    imagem.pixels.foreach_set(rgba.ravel())
    imagem.filepath_raw = caminho
    imagem.file_format = "PNG"
    imagem.save()
    bpy.data.images.remove(imagem)


# ---------------------------------------------------------------------------
# O veredicto
# ---------------------------------------------------------------------------


def veredicto(v, medidas, leituras, desfoque, ancora, parametros):
    n = len(v["pecas"])
    m24 = medidas.get(v["id"], {}).get("24", {})
    temas = {
        tema: m24.get(tema, {}).get("duas", {}).get("limpa") == n and m24.get(tema, {}).get("uma", {}).get("limpa") == n
        for tema in TEMAS
    }
    fina = min(p["espessura"] for p in v["pecas"]) * 24 / 100
    junta = v.get("junta") or 0
    pixeis = all(temas.values()) and fina >= 2 and junta >= 1.5
    corte = v.get("recorte")
    recorte = corte is not None and corte["perda"] < parametros["recorte"]["limiar_perna"]
    d, a = desfoque.get(v["id"]), desfoque.get(ancora)
    tol = parametros["desfoque"]["tolerancia"]
    destoa = None
    if d and a:
        destoa = abs(d["peso"] / a["peso"] - 1) > tol or abs(d["mancha"] / a["mancha"] - 1) > tol
    leitura = leituras.get(v["id"])
    forma = bool(leitura and leitura.get("forma"))
    letra = bool(leitura and leitura.get("letra") == "L")
    limpa = bool(leitura) and not leitura.get("lista_negra")
    return {
        "pixeis_24": pixeis,
        "temas_24": temas,
        "peca_mais_fina_24": round(fina, 2),
        "junta_24": round(junta, 2),
        "recorte": recorte,
        "alinhada": bool(v.get("alinhada")),
        "destoa": destoa,
        "forma": forma,
        "letra": letra,
        "lista_negra_limpa": limpa,
        "lida": leitura is not None,
        "aprovada": pixeis and recorte and bool(v.get("alinhada")) and forma and letra and limpa,
    }


# ---------------------------------------------------------------------------
# Folhas
# ---------------------------------------------------------------------------


def grupos(parametros, todas, referencias):
    saida = [("REF", "referências, fora da contagem", referencias)]
    for con in parametros["conceitos"]:
        titulo = f"{con['letra']} · {con['nome']} · {con['categoria']}"
        saida.append((con["letra"], titulo, [v for v in todas if v["familia"] == con["letra"]]))
    return saida


def folha_24(lista):
    """Só os ids, sem nomes nem categorias: a leitura faz-se sem contexto."""
    m, rotulo, passo, cabeca, linha_a = 20, 44, 84, 64, 52
    largura = m + rotulo + 4 * passo - 28 + m + 40
    altura = cabeca + len(lista) * linha_a + m
    folha = gerar.Folha(2 * largura, altura)

    def cabecalho(tema):
        return [
            (f"Sessão 19b · 24 px · sobre o {tema}", 15, False),
            ("Em cada par: duas tonalidades, uma cor. Ver a 100 %.", 12, True),
        ]

    sessao19.paineis(folha, largura, cabecalho)
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        for r, (letra, _, vs) in enumerate(lista):
            y = cabeca + r * linha_a
            folha.escrever(letra, x0 + m, y + 6, 12, sessao19.cor_do_texto(tema, True))
            for c, v in enumerate(vs):
                x = x0 + m + rotulo + c * passo
                folha.pousar(v, x, y, 24, False, sessao19.tons(tema, False), tema=tema)
                folha.pousar(v, x + 32, y, 24, True, sessao19.tons(tema, True), tema=tema)
                folha.escrever(v["id"], x + 28, y + 24 + 5, 10, sessao19.cor_do_texto(tema), "CENTER")
    return folha


def folha_medicao(lista, n_variantes):
    m, rotulo, passo, cabeca, linha_a = 20, 0, 380, 64, 107
    alto = 22 + linha_a
    largura = m + 4 * passo - 34 + m
    altura = cabeca + len(lista) * alto + m
    folha = gerar.Folha(2 * largura, altura)

    def cabecalho(tema):
        return [
            (f"Bricklap · sessão 19b · as {n_variantes} variantes e as referências a 73, 48 e 24 px, sobre o {tema}", 15, False),
            ("Em cada variante, por tamanho: duas tonalidades, uma cor. À escala real, nada ampliado.", 12, True),
        ]

    sessao19.paineis(folha, largura, cabecalho)
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        for r, (_, titulo, vs) in enumerate(lista):
            y = cabeca + r * alto
            folha.escrever(titulo, x0 + m, y, 12, sessao19.cor_do_texto(tema))
            for c, v in enumerate(vs):
                x = x0 + m + rotulo + c * passo
                yy = y + 22
                for dx, n, dy in ((0, 73, 0), (170, 48, 12), (290, 24, 24)):
                    folha.pousar(v, x + dx, yy + dy, n, False, sessao19.tons(tema, False), tema=tema)
                    folha.pousar(v, x + dx + n + 8, yy + dy, n, True, sessao19.tons(tema, True), tema=tema)
                folha.escrever(f"{v['id']}  ·  {descricao(v)}", x, yy + 73 + 6, 11, sessao19.cor_do_texto(tema, True))
    return folha


def folha_desfoque_base(lista, desfoque, vereditos):
    """A uma cor sobre o creme: a 24 px nítida, a 24 px desfocada e a desfocada ×3 (os vazios enchem-se depois)."""
    m, rotulo, passo, cabeca, linha_a = 20, 44, 176, 64, 104
    largura = m + rotulo + 4 * passo + m
    folha = gerar.Folha(largura, cabeca + len(lista) * linha_a + m)
    folha.retangulo(0, 0, largura, folha.altura, "creme", -1.0)
    folha.escrever("Sessão 19b · teste do desfoque · uma cor sobre o creme, gaussiana de σ = 2 px", m, 14, 15)
    folha.escrever(
        "Em cada variante: 24 px nítida, 24 px desfocada, a desfocada ×3. Peso = cobertura média; mancha = máximo desfocado.",
        m,
        38,
        12,
        "texto2",
    )
    vazios = []
    for r, (letra, _, vs) in enumerate(lista):
        y = cabeca + r * linha_a
        folha.escrever(letra, m, y + 6, 12, "texto2")
        for c, v in enumerate(vs):
            x = m + rotulo + c * passo
            folha.pousar(v, x, y, 24, True, {"B": "K", "L": "K"}, tema="desfoque")
            vazios.append((v["id"], x, y))
            d = desfoque.get(v["id"])
            if d:
                marca = {True: " · destoa", False: "", None: ""}[vereditos[v["id"]]["destoa"]]
                folha.escrever(f"{v['id']}{marca}", x, y + 76, 10)
                folha.escrever(f"peso {_num(d['peso'])} · mancha {_num(d['mancha'])}", x, y + 89, 9, "texto2")
    return folha, vazios


def encher_desfoque(caminho, vazios, cores, sigma):
    imagem = gerar.ler_png(caminho)
    creme = np.array(gerar.hexa_para_srgb(cores["creme"])) * 255
    tinta = np.array(gerar.hexa_para_srgb(cores["uma_cor_creme"])) * 255
    for _, x, y in vazios:
        c = cobertura_uma_cor(imagem[y : y + 24, x : x + 24], cores)
        borrada = gaussiana(np.pad(c, 8), sigma)
        pequena = borrada[8:-8, 8:-8]
        grande = np.repeat(np.repeat(pequena, 3, axis=0), 3, axis=1)
        for dx, bloco in ((32, pequena), (64, grande)):
            h, w = bloco.shape
            imagem[y : y + h, x + dx : x + dx + w] = creme + bloco[:, :, None] * (tinta - creme)
    gravar_png(caminho, imagem)


def folha_73(itens, n_aprovadas):
    m, cabeca, linha_a, largura = 20, 64, 73 + 40, 600
    folha = gerar.Folha(2 * largura, cabeca + len(itens) * linha_a + (40 if not n_aprovadas else 0) + m)

    def cabecalho(tema):
        return [
            (f"Bricklap · sessão 19b · as {n_aprovadas} aprovadas a 73 px, sobre o {tema}", 15, False),
            ("73 px é o cabeçalho real no telemóvel do fundador. As duas primeiras são referências: o símbolo atual e a P2122.", 12, True),
        ]

    sessao19.paineis(folha, largura, cabecalho)
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        for i, v in enumerate(itens):
            y = cabeca + i * linha_a
            folha.pousar(v, x0 + m, y, 73, False, sessao19.tons(tema, False))
            folha.pousar(v, x0 + m + 89, y, 73, True, sessao19.tons(tema, True))
            folha.escrever(v["id"], x0 + m + 190, y + 12, 18, sessao19.cor_do_texto(tema))
            folha.escrever(f"{v.get('nome', '')} · {descricao(v)}", x0 + m + 190, y + 42, 12, sessao19.cor_do_texto(tema, True))
        if not n_aprovadas:
            folha.escrever("Nenhuma variante nova aprovada.", x0 + m, cabeca + len(itens) * linha_a + 8, 15, sessao19.cor_do_texto(tema))
    return folha


def folha_recorte(itens, n_aprovadas, parametros):
    caixa = 144
    raio = parametros["recorte"]["raio_na_grelha"] / 24 * caixa
    m, cabeca, passo, linha_a = 20, 64, caixa + 36, caixa + 52
    largura = m + 3 * passo + 340 + m
    folha = gerar.Folha(largura, cabeca + len(itens) * linha_a + m)
    folha.retangulo(0, 0, largura, folha.altura, "recorte_fundo", -1.0)
    folha.escrever(f"Bricklap · sessão 19b · a P2122 e as {n_aprovadas} aprovadas no recorte circular do ícone adaptativo", m, 14, 15)
    folha.escrever(
        "A caixa de 24 é a janela de 72 dp de uma tela de 108; o círculo é o de 66 dp. Sobre o creme, o escuro e o campo do ícone da app.",
        m,
        38,
        12,
    )
    tratamentos = (
        ("creme", "creme", {"B": "B", "L": "L"}),
        ("escuro", "escuro", {"B": "B", "L": "L"}),
        ("campo", "campo", {"B": "campo_peca", "L": "L"}),
    )
    for i, v in enumerate(itens):
        y = cabeca + i * linha_a
        for j, (nome, fundo, mapa) in enumerate(tratamentos):
            x = m + j * passo
            cx, cy = x + caixa / 2, y + caixa / 2
            folha.poligono([sessao19.circulo(cx, cy, raio)], fundo, -0.5)
            folha.pousar(v, x, y, caixa, False, mapa)
            aro = [(x - 2, y - 2), (x + caixa + 2, y - 2), (x + caixa + 2, y + caixa + 2), (x - 2, y + caixa + 2)]
            folha.poligono([aro, list(reversed(sessao19.circulo(cx, cy, raio)))], "recorte_fundo", 0.5)
            folha.escrever(nome, cx, y + caixa + 8, 12, "texto", "CENTER")
        folha.escrever(v["id"], m + 3 * passo, y + 20, 20)
        folha.escrever(descricao(v), m + 3 * passo, y + 52, 12)
        folha.escrever(f"perna mais cortada: {_num(v['recorte']['perda'] * 100, 1)} % da área", m + 3 * passo, y + 74, 12)
    return folha


BRACOS = (
    ("atual", "haste #C0402C · pé #E89478", {"B": "B", "L": "L"}),
    ("(a) tons trocados", "haste #E89478 · pé #C0402C", {"B": "L", "L": "B"}),
    ("(b) uma cor só", "haste e pé #C0402C", {"B": "B", "L": "B"}),
    ("(c) claro escurecido", "haste #C0402C · pé {Lc}", {"B": "B", "L": "Lc"}),
)


def bracos(cores, limiar):
    """[(nome, legenda, mapa, {tema: {haste, pé}}, passa)] — o contraste das duas peças nos dois temas."""
    hexa = {"B": cores["B"], "L": cores["L"], "Lc": cores["Lc"]}
    saida = []
    for nome, legenda, mapa in BRACOS:
        valores = {
            tema: {"haste": contraste(hexa[mapa["B"]], cores[tema]), "pé": contraste(hexa[mapa["L"]], cores[tema])}
            for tema in TEMAS
        }
        passa = all(x >= limiar for t in valores.values() for x in t.values())
        saida.append((nome, legenda.format(Lc=cores["Lc"]), mapa, valores, passa))
    return saida


def folha_contraste(variantes, lista_bracos):
    m, rotulo, cabeca, linha_a, largura = 20, 250, 64, 73 + 26, 780
    folha = gerar.Folha(2 * largura, cabeca + len(lista_bracos) * len(variantes) * linha_a + m)

    def cabecalho(tema):
        return [
            (f"Bricklap · sessão 19b · passo 4, o contraste · sobre o {tema}", 15, False),
            ("A P2122 e a P2121 em quatro colorações, a 73, 48 e 24 px. Passa com as duas peças a 3:1 nos dois temas.", 12, True),
        ]

    sessao19.paineis(folha, largura, cabecalho)
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        linha = 0
        for nome, legenda, mapa, valores, passa in lista_bracos:
            for v in variantes:
                y = cabeca + linha * linha_a
                linha += 1
                folha.escrever(f"{nome} · {v['id']}", x0 + m, y + 10, 13, sessao19.cor_do_texto(tema))
                folha.escrever(legenda, x0 + m, y + 32, 11, sessao19.cor_do_texto(tema, True))
                x = x0 + m + rotulo
                for dx, n, dy in ((0, 73, 0), (89, 48, 12), (153, 24, 24)):
                    folha.pousar(v, x + dx, y + dy, n, False, mapa)
                t = valores[tema]
                folha.escrever(
                    f"haste {_num(t['haste'])}:1 · pé {_num(t['pé'])}:1", x + 200, y + 18, 12, sessao19.cor_do_texto(tema)
                )
                folha.escrever(
                    "passa nos dois temas" if passa else "chumba", x + 200, y + 40, 12, sessao19.cor_do_texto(tema, True)
                )
    return folha


# ---------------------------------------------------------------------------
# Tabelas
# ---------------------------------------------------------------------------


def _pixeis(v, medidas, ver):
    n = len(v["pecas"])
    partes = []
    for tema in TEMAS:
        if ver["temas_24"][tema]:
            partes.append("sim")
        else:
            caixa = medidas.get(v["id"], {}).get("24", {}).get(tema, {})
            partes.append(f"não ({caixa.get('duas', {}).get('limpa')}/{n} · {caixa.get('uma', {}).get('limpa')}/{n})")
    texto = " · ".join(partes)
    if ver["peca_mais_fina_24"] < 2:
        texto += f"; peça de {_num(ver['peca_mais_fina_24'])} px"
    return texto


def tabela_md(linhas):
    saida = [
        "| id | cat. | variação | 24 px: peças (creme · escuro) | alinhada | recorte | desfoque: peso · mancha | contraste da letra (creme · escuro) | (7a) que forma | (7b) que letra | (6) lista negra | passa |",
        "|---|---|---|---|:---:|---|---|---|---|---|---|:---:|",
    ]
    for v, medidas, ver, leitura, desf, cont in linhas:
        corte = v.get("recorte")
        recorte = "—" if corte is None else f"{'sim' if ver['recorte'] else 'não'} ({_num(corte['perda'] * 100, 1)} %)"
        d = "—" if not desf else f"{_num(desf['peso'])} · {_num(desf['mancha'])}" + (" · **destoa**" if ver["destoa"] else "")
        c = cont["creme"]["letra"], cont["escuro"]["letra"]
        contr = "—" if c[0] is None else f"{_num(c[0])} · {_num(c[1])}" + ("" if min(c) >= 3 else " (< 3:1)")
        if leitura is None:
            forma = letra = negra = "por ler"
        else:
            forma = leitura.get("forma") or "—"
            letra = leitura.get("letra") or "—"
            if leitura.get("onde"):
                letra += f" ({leitura['onde']})"
            negra = leitura.get("lista_negra") or "—"
        ident = f"**{v['id']}**" if ver["aprovada"] else v["id"]
        passa = "**✓**" if ver["aprovada"] else "—"
        saida.append(
            f"| {ident} | {v.get('categoria', '—')} | {descricao(v)} | {_pixeis(v, medidas, ver)} | {'sim' if ver['alinhada'] else 'não'} "
            f"| {recorte} | {d} | {contr} | {forma} | {letra} | {negra} | {passa} |"
        )
    return "\n".join(saida) + "\n"


def contraste_md(cores, lista_bracos, limiar):
    saida = [
        f"Tom claro escurecido (c): **{cores['Lc']}** — matiz HSL {_num(matiz(cores['Lc']), 1)}° "
        f"(o `#E89478` está a {_num(matiz(cores['L']), 1)}°).",
        "",
        "| braço | cores | haste / creme | pé / creme | haste / escuro | pé / escuro | passa (≥ 3:1 nas duas peças, nos dois temas) |",
        "|---|---|---:|---:|---:|---:|:---:|",
    ]
    for nome, legenda, _, valores, passa in lista_bracos:
        c, e = valores["creme"], valores["escuro"]
        saida.append(
            f"| {nome} | {legenda} | {_num(c['haste'])}:1 | {_num(c['pé'])}:1 | {_num(e['haste'])}:1 | {_num(e['pé'])}:1 | {'**sim**' if passa else 'não'} |"
        )
    saida += [
        "",
        "A distância entre os dois tons, que é o que a regra das duas tonalidades protege:",
        "",
        "| par | contraste entre os dois | ΔE (CIE76) |",
        "|---|---:|---:|",
        f"| `#C0402C` e `#E89478` (atual) | {_num(contraste(cores['B'], cores['L']))}:1 | {_num(delta_e(cores['B'], cores['L']), 1)} |",
        f"| `#C0402C` e `{cores['Lc']}` (c) | {_num(contraste(cores['B'], cores['Lc']))}:1 | {_num(delta_e(cores['B'], cores['Lc']), 1)} |",
    ]
    return "\n".join(saida) + "\n"


# ---------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = argparse.ArgumentParser(prog="sessao19b.py")
    args.add_argument("--parametros", required=True)
    args.add_argument("--saida", required=True)
    args.add_argument("--leituras")
    opcoes = args.parse_args(argv)

    with open(opcoes.parametros, encoding="utf-8") as f:
        parametros = json.load(f)
    leituras = {}
    if opcoes.leituras and os.path.exists(opcoes.leituras):
        with open(opcoes.leituras, encoding="utf-8") as f:
            leituras = json.load(f).get("leituras", {})
    os.makedirs(opcoes.saida, exist_ok=True)
    cores = dict(parametros["cores"])
    limiar = parametros["contraste"]["limiar"]
    cores["Lc"] = escurecer_ate(cores["L"], cores["creme"], limiar)
    amostras = parametros["amostras"]
    sigma = parametros["desfoque"]["sigma_px"]

    inicio = time.time()
    todas = repertorio.variantes(parametros)
    referencias = repertorio.referencias(parametros["recorte"]["raio_na_grelha"])
    lista = grupos(parametros, todas, referencias)
    print(f"[marca] {len(todas)} variantes e {len(referencias)} referências; tom (c) {cores['Lc']}")

    materiais = sessao19.materiais_da_sessao(cores)
    materiais["Lc"] = gerar.material_de_emissao("Lc", cores["Lc"])
    caminho = {
        nome: os.path.join(opcoes.saida, f"{nome}.png")
        for nome in (
            "folha-24px",
            "folha-medicao",
            "folha-desfoque",
            "folha-73px-aprovadas",
            "folha-recorte-aprovadas",
            "folha-contraste",
        )
    }
    f24 = folha_24(lista)
    fmed = folha_medicao(lista, len(todas))
    f24.renderizar(caminho["folha-24px"], amostras["folha_24"], materiais)
    fmed.renderizar(caminho["folha-medicao"], amostras["medicao"], materiais)

    imagem24 = gerar.ler_png(caminho["folha-24px"])
    medidas = sessao19.medir([(imagem24, f24, {24}), (gerar.ler_png(caminho["folha-medicao"]), fmed, {48, 73})], cores)
    desfoque = medir_desfoque(imagem24, f24, cores, sigma)
    ancora = parametros["desfoque"]["ancora"]

    linhas, aprovadas, vereditos = [], [], {}
    novas = {v["id"] for v in todas}
    for v in referencias + todas:
        ver = veredicto(v, medidas, leituras, desfoque, ancora, parametros)
        vereditos[v["id"]] = ver
        cont = contraste_da_variante(v, cores) if v["id"] != "REF" else {t: {"letra": None, "mais_fraca": None} for t in TEMAS}
        linhas.append((v, medidas, ver, leituras.get(v["id"]), desfoque.get(v["id"]), cont))
        if ver["aprovada"] and v["id"] in novas:
            aprovadas.append(v)
    print(f"[marca] lidas {sum(1 for v in todas if v['id'] in leituras)} de {len(todas)}; aprovadas {len(aprovadas)}")

    fdes, vazios = folha_desfoque_base(lista, desfoque, vereditos)
    fdes.renderizar(caminho["folha-desfoque"], amostras["folha_24"], materiais)
    encher_desfoque(caminho["folha-desfoque"], vazios, cores, sigma)

    p2122 = next(v for v in referencias if v["id"] == "P2122")
    folha_73([referencias[0], p2122] + aprovadas, len(aprovadas)).renderizar(
        caminho["folha-73px-aprovadas"], amostras["aprovadas"], materiais
    )
    folha_recorte([p2122] + aprovadas, len(aprovadas), parametros).renderizar(
        caminho["folha-recorte-aprovadas"], amostras["recorte"], materiais
    )
    lista_bracos = bracos(cores, limiar)
    alvo = [v for v in referencias if v["id"] in parametros["contraste"]["variantes"]]
    folha_contraste(alvo, lista_bracos).renderizar(caminho["folha-contraste"], amostras["contraste"], materiais)

    saida_json = {
        "tom_c": cores["Lc"],
        "bracos": [
            {"braco": nome, "cores": legenda, "contraste": valores, "passa": passa}
            for nome, legenda, _, valores, passa in lista_bracos
        ],
        "variantes": [
            {
                "id": v["id"],
                "familia": v["familia"],
                "categoria": v.get("categoria"),
                "variacao": v["variacao"],
                "construcao": v.get("construcao"),
                "pecas": [{"nome": p.get("nome"), "tom": p["tom"], "raio24": p.get("raio24")} for p in v["pecas"]],
                "recorte": v.get("recorte"),
                "medidas": medidas_.get(v["id"], {}),
                "desfoque": None if not desf else {"peso": desf["peso"], "mancha": desf["mancha"]},
                "contraste": cont,
                "veredicto": ver,
                "leitura": leitura,
            }
            for v, medidas_, ver, leitura, desf, cont in linhas
        ],
    }
    with open(os.path.join(opcoes.saida, "medidas.json"), "w", encoding="utf-8") as f:
        json.dump(saida_json, f, ensure_ascii=False, indent=1)
    with open(os.path.join(opcoes.saida, "medidas.md"), "w", encoding="utf-8") as f:
        f.write(tabela_md(linhas))
    with open(os.path.join(opcoes.saida, "contraste.md"), "w", encoding="utf-8") as f:
        f.write(contraste_md(cores, lista_bracos, limiar))
    print(f"[marca] pronto em {time.time() - inicio:.1f} s: {opcoes.saida}")


if __name__ == "__main__":
    main()
