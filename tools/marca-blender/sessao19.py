"""
Fábrica de silhuetas, sessão 19: as quatro sementes do CTO, varridas.

Corre dentro do Blender, sem interface, pelo gerar.sh:

    tools/marca-blender/gerar.sh --sessao 19 [pasta]

Reutiliza o gerar.py da sessão 18 (a cena plana, a folha, as regiões
conexas), com as famílias de sementes.py. O que muda face à 18:

  - três tamanhos, 24, 48 e 73 px — 73 é o cabeçalho real no telemóvel do
    fundador (26 dp a 2,8125);
  - dois temas: o creme (#FBF8F4) e o escuro (#121010) da app, a duas
    tonalidades e a uma cor (tinta #16120F no creme, branco no escuro);
  - o recorte circular do ícone adaptativo: a caixa de 24 é a janela de 72 dp
    de uma tela de 108, e o círculo é o de 66 dp;
  - as leituras humanas — que forma, que letra, que leitura da lista negra —
    entram por um ficheiro (leituras-sessao-19.json), e é com elas que o
    script escolhe as aprovadas para as folhas de 73 px e do recorte.

Folhas: folha-24px.png (todas, creme e escuro), folha-medicao.png (todas, a
24, 48 e 73 px, onde se medem os 48 e os 73), folha-73px-aprovadas.png e
folha-recorte-aprovadas.png. Medidas em medidas.json e medidas.md.
"""

import argparse
import json
import math
import os
import sys
import time

import bpy  # noqa: F401  (o gerar.py usa-o; aqui só garante que se corre no Blender)
import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gerar  # noqa: E402
import sementes  # noqa: E402

TEMAS = ("creme", "escuro")
RAIOS = {0: "raio 0", 1: "raio 1", 2.5: "raio 2,5"}


def materiais_da_sessao(cores):
    compat = {
        "fundo": cores["folha"],
        "B": cores["B"],
        "L": cores["L"],
        "uma_cor": cores["uma_cor_creme"],
        "texto": cores["texto_creme"],
        "texto2": cores["texto2_creme"],
    }
    materiais = gerar.preparar_cena(compat)
    for chave in (
        "uma_cor_escuro",
        "creme",
        "escuro",
        "campo",
        "campo_peca",
        "texto_escuro",
        "texto2_escuro",
        "folha",
        "recorte_fundo",
    ):
        materiais[chave] = gerar.material_de_emissao(chave, cores[chave])
    return materiais


def tons(tema, uma_cor):
    """Material de cada tom: a duas tonalidades é sempre B e L; a uma cor, a tinta do tema."""
    if not uma_cor:
        return {"B": "B", "L": "L"}
    return {"B": "K", "L": "K"} if tema == "creme" else {"B": "uma_cor_escuro", "L": "uma_cor_escuro"}


def cor_do_texto(tema, secundario=False):
    if tema == "creme":
        return "texto2" if secundario else "texto"
    return "texto2_escuro" if secundario else "texto_escuro"


def _valor(valor):
    if isinstance(valor, float):
        return f"{valor:.2f}".rstrip("0").rstrip(".").replace(".", ",")
    return str(valor)


def descricao(v):
    p = v["variacao"]
    if v["familia"] == "REF":
        return "o símbolo atual (docs/marca), para comparar"
    if not p:
        return "semente, tal como desenhada"
    return f"esp. {_valor(p['espessura'])} · junta {_valor(p['junta'])} · desenc. {_valor(p['desencontro'])} · raio {_valor(p['raio'])}"


# ---------------------------------------------------------------------------
# Medidas: quantas peças se separam, sobre cada fundo
# ---------------------------------------------------------------------------


def cobertura(recorte, fundo, tintas):
    """Cobertura de cada tinta em cada píxel, sobre o fundo (a mistura é em sRGB, como no render)."""
    f = np.array(gerar.hexa_para_srgb(fundo)) * 255
    base = np.stack([np.array(gerar.hexa_para_srgb(t)) * 255 - f for t in tintas], axis=1)
    alvo = (recorte.reshape(-1, 3) - f).T
    c = np.linalg.lstsq(base, alvo, rcond=None)[0]
    return [c[k].reshape(recorte.shape[:2]) for k in range(len(tintas))]


def medir_caixa(recorte, tema, uma_cor, cores):
    if uma_cor:
        (k,) = cobertura(recorte, cores[tema], [cores["uma_cor_" + tema]])
        return {nome: gerar.componentes((k >= limiar).astype(np.int8)) for nome, limiar in gerar.LIMIARES.items()}
    b, l_ = cobertura(recorte, cores[tema], [cores["B"], cores["L"]])
    tom = np.where(b >= l_, 1, 2)
    medida = {
        nome: gerar.componentes(np.where(b + l_ >= limiar, tom, 0).astype(np.int8))
        for nome, limiar in gerar.LIMIARES.items()
    }
    medida["L_limpo"] = int(np.sum(l_ >= 0.9))
    return medida


def medir(folhas, cores):
    """{id: {tamanho: {tema: {"duas": ..., "uma": ...}}}}, cada tamanho medido numa folha só."""
    medidas = {}
    for imagem, folha, tamanhos in folhas:
        for caixa in folha.caixas:
            n = caixa["tamanho"]
            if n not in tamanhos or "tema" not in caixa:
                continue
            recorte = imagem[caixa["y"] : caixa["y"] + n, caixa["x"] : caixa["x"] + n]
            lugar = medidas.setdefault(caixa["id"], {}).setdefault(str(n), {}).setdefault(caixa["tema"], {})
            lugar["uma" if caixa["uma_cor"] else "duas"] = medir_caixa(recorte, caixa["tema"], caixa["uma_cor"], cores)
    return medidas


# ---------------------------------------------------------------------------
# O veredicto: medidas (automáticas) e leituras (humanas), juntas
# ---------------------------------------------------------------------------


def veredicto(v, medidas, leituras, eliminadas, parametros):
    n = len(v["pecas"])
    m24 = medidas.get(v["id"], {}).get("24", {})
    temas = {}
    for tema in TEMAS:
        caixa = m24.get(tema, {})
        temas[tema] = (
            caixa.get("duas", {}).get("limpa") == n and caixa.get("uma", {}).get("limpa") == n
        )
    fina = min(p["espessura"] for p in v["pecas"]) * 24 / 100
    junta = v.get("junta") or 0
    pixeis = all(temas.values()) and fina >= 2 and junta >= 1.5
    corte = v.get("recorte")
    recorte = corte is not None and corte["perda"] < parametros["recorte"]["limiar_perna"]
    leitura = leituras.get(v["id"])
    forma = bool(leitura and leitura.get("forma"))
    letra = bool(leitura and leitura.get("letra") == "L")
    limpa = bool(leitura) and not leitura.get("lista_negra")
    fora = v["familia"] in eliminadas
    return {
        "pixeis_24": pixeis,
        "temas_24": temas,
        "peca_mais_fina_24": round(fina, 2),
        "recorte": recorte,
        "forma": forma,
        "letra": letra,
        "lista_negra_limpa": limpa,
        "lida": leitura is not None,
        "familia_eliminada": fora,
        "aprovada": pixeis and recorte and forma and letra and limpa and not fora,
    }


# ---------------------------------------------------------------------------
# Folhas com todas as variantes: a dos 24 px e a de medição
# ---------------------------------------------------------------------------


def titulo_da_familia(fam):
    eixos = " · ".join(
        f"{nome} {'/'.join(_valor(x) for x in valores)}" for nome, valores in fam["eixos"] if nome != "raio"
    )
    return f"{fam['titulo']}   ({eixos})"


def blocos(parametros, todas, referencias):
    """[(titulo, {(linha, coluna): variante})]: a referência e as sementes, e depois cada família.

    Nas famílias as colunas são as combinações de espessura, junta e desencontro
    (111 a 222) e as linhas são os três raios, pela ordem dos ids.
    """
    saida = [("Referência (o símbolo atual) e as quatro sementes, tal como o CTO as desenhou", {(0, c): v for c, v in enumerate(referencias)})]
    for fam in parametros["familias"]:
        vs = [v for v in todas if v["familia"] == fam["letra"]]
        saida.append((titulo_da_familia(fam), {(i % 3, i // 3): v for i, v in enumerate(vs)}))
    return saida


def paineis(folha, largura_painel, cabecalho):
    """Os dois temas lado a lado: o creme à esquerda, o escuro à direita."""
    for k, tema in enumerate(TEMAS):
        x0 = k * largura_painel
        folha.retangulo(x0, 0, largura_painel, folha.altura, tema, -1.0)
        for linha, (corpo, tamanho, secundario) in enumerate(cabecalho(tema)):
            folha.escrever(corpo, x0 + 20, 14 + linha * 24, tamanho, cor_do_texto(tema, secundario))


def folha_24(parametros, lista_blocos, n_variantes):
    m, rotulo, passo, cabeca = 20, 76, 84, 64
    alto_ref, alto_fam, linha_a = 80, 22 + 3 * 52 + 10, 52
    largura = m + rotulo + 8 * passo - 28 + m
    altura = cabeca + alto_ref + (len(lista_blocos) - 1) * alto_fam + m
    folha = gerar.Folha(2 * largura, altura)

    def cabecalho(tema):
        return [
            (f"Bricklap · sessão 19 · {n_variantes} variantes a 24 px, sobre o {tema} — ver a 100 %, sem ampliar", 15, False),
            ("Em cada par: duas tonalidades, uma cor. Colunas: espessura · junta · desencontro (111 a 222); linhas: raio 0, 1 e 2,5.", 12, True),
        ]

    paineis(folha, largura, cabecalho)
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        y = cabeca
        for b, (titulo, grelha) in enumerate(lista_blocos):
            folha.escrever(titulo, x0 + m, y, 12, cor_do_texto(tema))
            for (linha, coluna), v in grelha.items():
                x = x0 + m + rotulo + coluna * passo
                yy = y + 22 + linha * linha_a
                folha.pousar(v, x, yy, 24, False, tons(tema, False), tema=tema)
                folha.pousar(v, x + 32, yy, 24, True, tons(tema, True), tema=tema)
                folha.escrever(v["id"], x + 28, yy + 24 + 5, 10, cor_do_texto(tema), "CENTER")
            if b > 0:
                for linha, nome in enumerate(RAIOS.values()):
                    folha.escrever(nome, x0 + m, y + 22 + linha * linha_a + 6, 11, cor_do_texto(tema, True))
            y += alto_ref if b == 0 else alto_fam
    return folha


def folha_medicao(parametros, lista_blocos, n_variantes):
    m, rotulo, passo, cabeca, linha_a = 20, 76, 380, 64, 107
    alto_ref, alto_fam = 22 + linha_a, 22 + 3 * linha_a + 8
    largura = m + rotulo + 8 * passo - 34 + m
    altura = cabeca + alto_ref + (len(lista_blocos) - 1) * alto_fam + m
    folha = gerar.Folha(2 * largura, altura)

    def cabecalho(tema):
        return [
            (f"Bricklap · sessão 19 · as {n_variantes} variantes a 73, 48 e 24 px, sobre o {tema}", 15, False),
            ("Em cada variante, por tamanho: duas tonalidades, uma cor. À escala real, nada ampliado.", 12, True),
        ]

    paineis(folha, largura, cabecalho)
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        y = cabeca
        for b, (titulo, grelha) in enumerate(lista_blocos):
            folha.escrever(titulo, x0 + m, y, 12, cor_do_texto(tema))
            for (linha, coluna), v in grelha.items():
                x = x0 + m + rotulo + coluna * passo
                yy = y + 22 + linha * linha_a
                for dx, n, dy in ((0, 73, 0), (170, 48, 12), (290, 24, 24)):
                    folha.pousar(v, x + dx, yy + dy, n, False, tons(tema, False), tema=tema)
                    folha.pousar(v, x + dx + n + 8, yy + dy, n, True, tons(tema, True), tema=tema)
                folha.escrever(f"{v['id']}  ·  {descricao(v)}", x, yy + 73 + 6, 11, cor_do_texto(tema, True))
            if b > 0:
                for linha, nome in enumerate(RAIOS.values()):
                    folha.escrever(nome, x0 + m, y + 22 + linha * linha_a + 30, 11, cor_do_texto(tema, True))
            y += alto_ref if b == 0 else alto_fam
    return folha


# ---------------------------------------------------------------------------
# Folhas só com as aprovadas: 73 px e recorte circular
# ---------------------------------------------------------------------------


def folha_73(aprovadas, referencia):
    m, cabeca, linha_a, largura = 20, 64, 73 + 40, 560
    itens = [referencia] + aprovadas
    folha = gerar.Folha(2 * largura, cabeca + len(itens) * linha_a + (40 if not aprovadas else 0) + m)

    def cabecalho(tema):
        return [
            (f"Bricklap · sessão 19 · as {len(aprovadas)} aprovadas a 73 px, sobre o {tema}", 15, False),
            ("73 px é o cabeçalho real no telemóvel do fundador. Duas tonalidades, uma cor; a primeira é a referência.", 12, True),
        ]

    paineis(folha, largura, cabecalho)
    for k, tema in enumerate(TEMAS):
        x0 = k * largura
        for i, v in enumerate(itens):
            y = cabeca + i * linha_a
            folha.pousar(v, x0 + m, y, 73, False, tons(tema, False))
            folha.pousar(v, x0 + m + 89, y, 73, True, tons(tema, True))
            folha.escrever(v["id"], x0 + m + 190, y + 12, 18, cor_do_texto(tema))
            folha.escrever(descricao(v), x0 + m + 190, y + 42, 12, cor_do_texto(tema, True))
        if not aprovadas:
            folha.escrever("Nenhuma variante aprovada.", x0 + m, cabeca + linha_a + 8, 15, cor_do_texto(tema))
    return folha


def circulo(cx, cy, raio, segmentos=256):
    return [
        (cx + raio * math.cos(2 * math.pi * k / segmentos), cy + raio * math.sin(2 * math.pi * k / segmentos))
        for k in range(segmentos)
    ]


def folha_recorte(aprovadas, parametros):
    """Cada aprovada como ícone adaptativo com máscara circular: a caixa de 24 é a
    janela de 72 dp (a 2 px por dp, 144 px) e o círculo é o de 66 dp (132 px)."""
    caixa = 144
    raio = parametros["recorte"]["raio_na_grelha"] / 24 * caixa
    m, cabeca, passo, linha_a = 20, 64, caixa + 36, caixa + 52
    largura = m + 3 * passo + 320 + m
    folha = gerar.Folha(largura, cabeca + max(1, len(aprovadas)) * linha_a + m)
    folha.retangulo(0, 0, largura, folha.altura, "recorte_fundo", -1.0)
    folha.escrever(
        f"Bricklap · sessão 19 · as {len(aprovadas)} aprovadas no recorte circular do ícone adaptativo", m, 14, 15
    )
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
    for i, v in enumerate(aprovadas):
        y = cabeca + i * linha_a
        for j, (nome, fundo, mapa) in enumerate(tratamentos):
            x = m + j * passo
            cx, cy = x + caixa / 2, y + caixa / 2
            folha.poligono([circulo(cx, cy, raio)], fundo, -0.5)
            folha.pousar(v, x, y, caixa, False, mapa)
            aro = [(x - 2, y - 2), (x + caixa + 2, y - 2), (x + caixa + 2, y + caixa + 2), (x - 2, y + caixa + 2)]
            folha.poligono([aro, list(reversed(circulo(cx, cy, raio)))], "recorte_fundo", 0.5)
            folha.escrever(nome, cx, y + caixa + 8, 12, "texto", "CENTER")
        perda = v["recorte"]["perda"] * 100
        folha.escrever(v["id"], m + 3 * passo, y + 20, 20)
        folha.escrever(descricao(v), m + 3 * passo, y + 52, 12)
        folha.escrever(f"perna mais cortada: {_valor(round(perda, 1))} % da área", m + 3 * passo, y + 74, 12)
    if not aprovadas:
        folha.escrever("Nenhuma variante aprovada.", m, cabeca + 8, 15)
    return folha


# ---------------------------------------------------------------------------
# A tabela
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
        texto += f"; peça de {_valor(ver['peca_mais_fina_24'])} px"
    return texto


def tabela_md(linhas):
    saida = [
        "| id | variação | 24 px: peças (creme · escuro) | (a) que forma | (b) que letra | (c) recorte | (d) lista negra | passa |",
        "|---|---|---|---|---|---|---|:---:|",
    ]
    for v, medidas, ver, leitura in linhas:
        corte = v.get("recorte")
        recorte = "—" if corte is None else f"{'sim' if ver['recorte'] else 'não'} ({_valor(round(corte['perda'] * 100, 1))} %)"
        forma = (leitura or {}).get("forma") or "—"
        letra = (leitura or {}).get("letra") or "—"
        negra = (leitura or {}).get("lista_negra") or "—"
        if not ver["lida"]:
            forma = letra = negra = "por ler"
        passa = "**✓**" if ver["aprovada"] else ("família eliminada" if ver["familia_eliminada"] else "—")
        ident = f"**{v['id']}**" if ver["aprovada"] else v["id"]
        saida.append(
            f"| {ident} | {descricao(v)} | {_pixeis(v, medidas, ver)} | {forma} | {letra} | {recorte} | {negra} | {passa} |"
        )
    return "\n".join(saida) + "\n"


# ---------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = argparse.ArgumentParser(prog="sessao19.py")
    args.add_argument("--parametros", required=True)
    args.add_argument("--saida", required=True)
    args.add_argument("--leituras")
    opcoes = args.parse_args(argv)

    with open(opcoes.parametros, encoding="utf-8") as f:
        parametros = json.load(f)
    leituras = {}
    if opcoes.leituras and os.path.exists(opcoes.leituras):
        with open(opcoes.leituras, encoding="utf-8") as f:
            leituras = json.load(f)
    os.makedirs(opcoes.saida, exist_ok=True)
    cores = parametros["cores"]
    amostras = parametros["amostras"]

    inicio = time.time()
    todas = sementes.variantes(parametros)
    referencias = sementes.referencias(parametros["recorte"]["raio_na_grelha"])
    lista = blocos(parametros, todas, referencias)
    print(f"[marca] {len(todas)} variantes e {len(referencias)} referências em {time.time() - inicio:.1f} s")

    materiais = materiais_da_sessao(cores)
    caminho = {nome: os.path.join(opcoes.saida, f"{nome}.png") for nome in ("folha-24px", "folha-medicao", "folha-73px-aprovadas", "folha-recorte-aprovadas")}
    f24 = folha_24(parametros, lista, len(todas))
    fmed = folha_medicao(parametros, lista, len(todas))
    f24.renderizar(caminho["folha-24px"], amostras["folha_24"], materiais)
    fmed.renderizar(caminho["folha-medicao"], amostras["medicao"], materiais)

    medidas = medir(
        [(gerar.ler_png(caminho["folha-24px"]), f24, {24}), (gerar.ler_png(caminho["folha-medicao"]), fmed, {48, 73})],
        cores,
    )
    lidas = leituras.get("leituras", {})
    eliminadas = leituras.get("familias_eliminadas", {})
    linhas, aprovadas = [], []
    for v in referencias + todas:
        ver = veredicto(v, medidas, lidas, eliminadas, parametros)
        linhas.append((v, medidas, ver, lidas.get(v["id"])))
        if ver["aprovada"] and v["familia"] not in ("REF", "SEM"):
            aprovadas.append(v)
    print(f"[marca] lidas {sum(1 for v in todas if v['id'] in lidas)} de {len(todas)}; aprovadas {len(aprovadas)}")

    folha_73(aprovadas, referencias[0]).renderizar(caminho["folha-73px-aprovadas"], amostras["aprovadas"], materiais)
    folha_recorte(aprovadas, parametros).renderizar(caminho["folha-recorte-aprovadas"], amostras["recorte"], materiais)

    saida_json = [
        {
            "id": v["id"],
            "familia": v["familia"],
            "variacao": v["variacao"],
            "pecas": len(v["pecas"]),
            "tons": "".join(p["tom"] for p in v["pecas"]),
            "recorte": v.get("recorte"),
            "medidas": medidas.get(v["id"], {}),
            "veredicto": ver,
            "leitura": leitura,
        }
        for v, medidas_, ver, leitura in linhas
    ]
    with open(os.path.join(opcoes.saida, "medidas.json"), "w", encoding="utf-8") as f:
        json.dump(saida_json, f, ensure_ascii=False, indent=1)
    with open(os.path.join(opcoes.saida, "medidas.md"), "w", encoding="utf-8") as f:
        f.write(tabela_md(linhas))
    print(f"[marca] pronto em {time.time() - inicio:.1f} s: {opcoes.saida}")


if __name__ == "__main__":
    main()
