"""
Sessão 24: as folhas de contacto e a tabela, fora do Blender, a partir dos renders da cadeia.

    python3 -B tools/marca-blender/sessao24_folhas.py <pasta-das-formas>

Lê, na pasta das formas: formas-sessao-24.json, semelhanca.json, mascaras/, e
medicao/ (a saída do sessao24.sh: as folhas, medidas.json e caixas.json). Lê as
leituras humanas de leituras-sessao-24.json, ao lado deste script (sem elas, as
colunas da leitura ficam por preencher). Nada é redesenhado aqui: cada imagem é
um recorte dos PNG do Blender, e o ×6 é o píxel de 24 ampliado por vizinho mais
próximo.

Grava em medicao/: folha-contacto.png (todas a 73 e 24 px, com o veredicto),
folha-revisao-<n>.png (doze por folha: 73, 48, 24 creme e escuro, 24 ×6, o
recorte, o desfoque ×3 e os números), medidas.md (a tabela com todos os
critérios) e fidelidade.json (cada caixa de 73 px contra a máscara reduzida —
prova de que o Blender encheu os polígonos como a forma é).

Os critérios, por ordem, e todos se mostram mesmo quando o primeiro já elimina:
  1. semelhança com marcas existentes > 0,40 — elimina (0,30–0,40: com o número);
  2. legível a 24 px: nenhuma junta cola e nenhuma contraforma fecha, nos dois
     temas, e a leitura não se perde;
  3. recorte circular: perda da forma ≤ 25 %, e a leitura sobrevive;
  4. uma cor: todas são a uma cor por construção (medido no creme e no escuro);
  5. lista negra de controlos de interface;
  6. as duas perguntas: que forma é? que letra ou ideia é?
  Reportado, não elimina: o desfoque (±25 % da P2122).
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
FONTE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
NEGRITO = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
TEMAS = ("creme", "escuro")
ELIMINA, AVISA = 0.40, 0.30


def f(tamanho, negrito=False):
    return ImageFont.truetype(NEGRITO if negrito else FONTE, tamanho)


def num(v, casas=2):
    return f"{v:.{casas}f}".replace(".", ",")


def pct(v):
    return f"{v * 100:+.0f} %".replace("+-", "−").replace("-", "−")


def srgb_lin(a):
    a = np.asarray(a, dtype=float) / 255
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def hexa(h):
    return [int(h[i : i + 2], 16) for i in (1, 3, 5)]


def carregar(pasta):
    med = os.path.join(pasta, "medicao")
    with open(os.path.join(pasta, "formas-sessao-24.json"), encoding="utf-8") as fh:
        formas = {v["id"]: v for v in json.load(fh)["variantes"]}
    with open(os.path.join(pasta, "semelhanca.json"), encoding="utf-8") as fh:
        semelhanca = json.load(fh)
    with open(os.path.join(med, "medidas.json"), encoding="utf-8") as fh:
        medidas = json.load(fh)
    with open(os.path.join(med, "caixas.json"), encoding="utf-8") as fh:
        caixas = json.load(fh)
    caminho = os.path.join(AQUI, "leituras-sessao-24.json")
    leituras = {}
    if os.path.exists(caminho):
        with open(caminho, encoding="utf-8") as fh:
            leituras = json.load(fh)["leituras"]
    imagens = {n: Image.open(os.path.join(med, f"{n}.png")).convert("RGB") for n in ("folha-24px", "folha-medicao", "folha-recorte", "folha-desfoque")}
    with open(os.path.join(AQUI, "parametros-sessao-19b.json"), encoding="utf-8") as fh:
        cores = json.load(fh)["cores"]
    return formas, semelhanca, medidas, caixas, leituras, imagens, cores


def recorte(imagens, caixas, folha, ident, tamanho, tema=None, cor="marca"):
    for c in caixas[folha]:
        if c["id"] == ident and c["tamanho"] == tamanho and (tema is None or c.get("tema") == tema) and (folha == "folha-recorte" or c.get("cor") == cor):
            return imagens[folha].crop((c["x"], c["y"], c["x"] + tamanho, c["y"] + tamanho))
    raise KeyError((folha, ident, tamanho, tema))


def recortes_do_icone(imagens, caixas, ident):
    """As três caixas do recorte de uma variante, pela ordem: creme, escuro, campo."""
    cs = [c for c in caixas["folha-recorte"] if c["id"] == ident]
    return [imagens["folha-recorte"].crop((c["x"] - 2, c["y"] - 2, c["x"] + 98, c["y"] + 98)) for c in cs]


def fidelidade(pasta, caixas, imagens, cores):
    saida = {}
    f0, t0 = srgb_lin(hexa(cores["creme"])), srgb_lin(hexa(cores["B"]))
    for c in caixas["folha-medicao"]:
        if c["tamanho"] != 73 or c.get("tema") != "creme":
            continue
        r = srgb_lin(np.asarray(imagens["folha-medicao"].crop((c["x"], c["y"], c["x"] + 73, c["y"] + 73))))
        k = np.clip(((r - f0) * (t0 - f0)).sum(2) / ((t0 - f0) ** 2).sum(), 0, 1)
        esperado = np.asarray(Image.open(os.path.join(pasta, "mascaras", f"{c['id']}.png")).convert("L").resize((73, 73), Image.BOX)).astype(float) / 255
        d = np.abs(k - esperado)
        saida[c["id"]] = {"diferenca_maxima": round(float(d.max()), 3), "pixeis_acima_de_meio": int((d > 0.5).sum())}
    return saida


def veredicto(ident, forma, semelhanca, medidas, leituras):
    s = semelhanca[ident]
    m = medidas[ident]
    lei = leituras.get(ident, {})
    motivos = []
    if s["maxima"] > ELIMINA:
        motivos.append(f"semelhança {num(s['maxima'], 3)} ({s['marca']})")
    perdas = m["perdas"]["24"]
    coladas = any(perdas[t]["pecas_coladas"] for t in TEMAS)
    fechadas = max(perdas[t]["furos_fechados"] for t in TEMAS)
    if coladas or fechadas:
        partes = (["junta colada"] if coladas else []) + ([f"{fechadas} contraforma fechada" + ("s" if fechadas > 1 else "")] if fechadas else [])
        motivos.append("24 px: " + " e ".join(partes))
    if lei.get("lembra"):
        motivos.append(f"lembra {lei['lembra']}")
    if lei.get("perde_24"):
        motivos.append("24 px: " + lei["perde_24"])
    if m["recorte"]["perda"] > 0.25 or lei.get("perde_recorte"):
        motivos.append("recorte" + (f": {lei['perde_recorte']}" if lei.get("perde_recorte") else ""))
    if lei.get("lista_negra"):
        motivos.append(f"lista negra: {lei['lista_negra']}")
    if lei and not lei.get("passa_leitura", False):
        motivos.append("leitura")
    if not lei and ident != "P2122":
        motivos.append("leitura por fazer")
    return motivos


def folha_contacto(ids, formas, semelhanca, medidas, leituras, imagens, caixas, destino):
    colunas, cw, ch, m, cab = 6, 250, 190, 24, 90
    linhas = math.ceil(len(ids) / colunas)
    folha = Image.new("RGB", (m * 2 + colunas * cw, cab + linhas * ch + m), (255, 255, 255))
    d = ImageDraw.Draw(folha)
    d.text((m, 18), "Bricklap · sessão 24 · regras abertas · todas as variantes a 73 e 24 px, uma cor, sobre o creme e o escuro", font=f(18, True), fill=(22, 18, 15))
    d.text((m, 48), "Renders da cadeia do Blender, recortados sem redesenhar. Verde: passa tudo · âmbar: passa, com semelhança entre 0,30 e 0,40 · vermelho: o primeiro motivo que a elimina.", font=f(13), fill=(90, 82, 75))
    for i, ident in enumerate(ids):
        x, y = m + (i % colunas) * cw, cab + (i // colunas) * ch
        folha.paste(recorte(imagens, caixas, "folha-medicao", ident, 73, "creme"), (x, y))
        folha.paste(recorte(imagens, caixas, "folha-medicao", ident, 73, "escuro"), (x + 78, y))
        folha.paste(recorte(imagens, caixas, "folha-24px", ident, 24, "creme"), (x + 158, y))
        folha.paste(recorte(imagens, caixas, "folha-24px", ident, 24, "escuro"), (x + 186, y))
        motivos = veredicto(ident, formas.get(ident), semelhanca, medidas, leituras)
        s = semelhanca[ident]["maxima"]
        cor = (170, 30, 30) if motivos else ((190, 120, 0) if s >= AVISA else (20, 130, 60))
        if ident == "P2122":
            cor = (60, 60, 60)
        d.text((x, y + 80), ident, font=f(15, True), fill=cor)
        conceito = formas[ident]["conceito"] if ident in formas else "âncora"
        d.text((x + 56, y + 82), conceito, font=f(11), fill=(90, 82, 75))
        d.text((x, y + 102), f"semelhança {num(s, 3)} · {semelhanca[ident]['marca']}", font=f(11), fill=(22, 18, 15))
        texto = "âncora" if ident == "P2122" else (motivos[0] if motivos else "passa")
        d.text((x, y + 120), texto[:38], font=f(11, bool(not motivos)), fill=cor)
        if len(motivos) > 1:
            d.text((x, y + 136), f"+ {len(motivos) - 1} motivo" + ("s" if len(motivos) > 2 else ""), font=f(10), fill=(120, 110, 100))
    folha.save(destino)


def folhas_revisao(ids, formas, semelhanca, medidas, leituras, imagens, caixas, pasta_saida):
    por_folha = 12
    caminhos = []
    for n in range(math.ceil(len(ids) / por_folha)):
        grupo = ids[n * por_folha : (n + 1) * por_folha]
        m, cab, lh = 20, 60, 176
        largura = 1480
        folha = Image.new("RGB", (largura, cab + len(grupo) * lh + m), (255, 255, 255))
        d = ImageDraw.Draw(folha)
        d.text((m, 16), f"Sessão 24 · revisão {n + 1} · 73 · 48 · 24 creme e escuro (100 %) · 24 ×6 · recorte (creme, escuro, campo) · desfoque ×3", font=f(15, True), fill=(22, 18, 15))
        for r, ident in enumerate(grupo):
            y = cab + r * lh
            x = m
            d.line([(m, y - 6), (largura - m, y - 6)], fill=(225, 220, 214))
            folha.paste(recorte(imagens, caixas, "folha-medicao", ident, 73, "creme"), (x, y))
            folha.paste(recorte(imagens, caixas, "folha-medicao", ident, 48, "creme"), (x + 80, y + 12))
            for j, tema in enumerate(TEMAS):
                folha.paste(recorte(imagens, caixas, "folha-24px", ident, 24, tema), (x + 136 + j * 30, y + 24))
                grande = recorte(imagens, caixas, "folha-24px", ident, 24, tema).resize((144, 144), Image.NEAREST)
                folha.paste(grande, (x + 200 + j * 152, y))
            for j, im in enumerate(recortes_do_icone(imagens, caixas, ident)):
                folha.paste(im.resize((90, 90), Image.LANCZOS), (x + 510 + j * 96, y))
            des = next(c for c in caixas["folha-desfoque"] if c["id"] == ident)
            folha.paste(imagens["folha-desfoque"].crop((des["x"] + 64, des["y"], des["x"] + 136, des["y"] + 72)), (x + 806, y))
            tx = x + 890
            me, s = medidas[ident], semelhanca[ident]
            conceito = formas[ident]["conceito"] if ident in formas else "âncora: a P2122"
            d.text((tx, y), f"{ident} · {conceito}", font=f(14, True), fill=(22, 18, 15))
            nome = formas[ident]["nome"] if ident in formas else "L de duas peças"
            d.text((tx, y + 20), nome.split(" · ", 1)[-1][:70], font=f(11), fill=(90, 82, 75))
            d.text((tx, y + 38), f"semelhança {num(s['maxima'], 3)} · {s['marca']} ({s['simbolo']})", font=f(11), fill=(22, 18, 15))
            p24 = " · ".join(f"{me['medidas']['24'][t]['pecas']}p {me['medidas']['24'][t]['furos']}f" for t in TEMAS)
            d.text((tx, y + 54), f"24 px: {p24} (a forma tem {me['pecas_n']}p {me['furos_n']}f)", font=f(11), fill=(22, 18, 15))
            ds = me["desfoque"]
            d.text((tx, y + 70), f"recorte {num(me['recorte']['perda'] * 100, 1)} % · peso {num(ds['peso'])} · mancha {num(ds['mancha'])}{' · destoa' if ds['destoa'] else ''}", font=f(11), fill=(22, 18, 15))
            lei = leituras.get(ident)
            if lei:
                d.text((tx, y + 90), f"forma: {lei['forma']}"[:92], font=f(11), fill=(22, 18, 15))
                d.text((tx, y + 106), f"letra/ideia: {lei['ideia']}"[:92], font=f(11), fill=(22, 18, 15))
            motivos = veredicto(ident, formas.get(ident), semelhanca, medidas, leituras)
            if ident != "P2122":
                texto = "passa" if not motivos else "chumba: " + "; ".join(motivos)
                d.text((tx, y + 126), texto[:92], font=f(11, True), fill=(170, 30, 30) if motivos else (20, 130, 60))
                if len(texto) > 92:
                    d.text((tx, y + 142), texto[92:184], font=f(11, True), fill=(170, 30, 30))
        caminho = os.path.join(pasta_saida, f"folha-revisao-{n + 1}.png")
        folha.save(caminho)
        caminhos.append(caminho)
    return caminhos


def tabela(ids, formas, semelhanca, medidas, leituras, destino):
    linhas = [
        "| id | ronda | conceito | categoria | o que usa das regras novas | semelhança (marca) | contra uma forma cheia (diagnóstico) | 24 px: peças · furos (creme / escuro; a forma) | recorte | uma cor | lista negra | que forma é? | que letra ou ideia? | desfoque: peso · mancha | veredicto |",
        "|---|:---:|---|---|---|---|---:|---|---:|:---:|---|---|---|---|---|",
    ]
    for ident in ids:
        me, s, fo, lei = medidas[ident], semelhanca[ident], formas.get(ident, {}), leituras.get(ident, {})
        p24 = " / ".join(f"{me['medidas']['24'][t]['pecas']} · {me['medidas']['24'][t]['furos']}" for t in TEMAS)
        ds = me["desfoque"]
        sem = f"{num(s['maxima'], 3)} ({s['marca']})"
        if s["maxima"] > ELIMINA:
            sem = f"**{sem}**"
        motivos = veredicto(ident, fo, semelhanca, medidas, leituras)
        ver = "âncora" if ident == "P2122" else ("**passa**" if not motivos else "chumba: " + "; ".join(motivos))
        linhas.append(
            f"| {ident} | {fo.get('ronda', '—')} | {fo.get('conceito', 'âncora: a P2122')} | {fo.get('categoria', '—')} | {fo.get('novas', '—')} | {sem} | {num(s['cheio'], 3)} | {p24}; {me['pecas_n']} · {me['furos_n']} "
            f"| {num(me['recorte']['perda'] * 100, 1)} % | sim | {lei.get('lista_negra') or '—'} | {lei.get('forma', '—')} | {lei.get('ideia', '—')} "
            f"| {num(ds['peso'])} ({pct(ds['peso'] / medidas['P2122']['desfoque']['peso'] - 1)}) · {num(ds['mancha'])} ({pct(ds['mancha'] / medidas['P2122']['desfoque']['mancha'] - 1)}) | {ver} |"
        )
    with open(destino, "w", encoding="utf-8") as fh:
        fh.write("\n".join(linhas) + "\n")


def main():
    pasta = sys.argv[1]
    formas, semelhanca, medidas, caixas, leituras, imagens, cores = carregar(pasta)
    ids = ["P2122"] + list(formas)
    med = os.path.join(pasta, "medicao")
    fid = fidelidade(pasta, caixas, imagens, cores)
    with open(os.path.join(med, "fidelidade.json"), "w", encoding="utf-8") as fh:
        json.dump(fid, fh, ensure_ascii=False, indent=1)
    pior = max(fid.values(), key=lambda v: v["diferenca_maxima"])
    print(f"fidelidade: pior diferença {pior['diferenca_maxima']}, píxeis acima de 0,5: {sum(v['pixeis_acima_de_meio'] for v in fid.values())}")
    folha_contacto(ids, formas, semelhanca, medidas, leituras, imagens, caixas, os.path.join(med, "folha-contacto.png"))
    for c in folhas_revisao(ids, formas, semelhanca, medidas, leituras, imagens, caixas, med):
        print(c)
    tabela(ids, formas, semelhanca, medidas, leituras, os.path.join(med, "medidas.md"))
    passam = [i for i in formas if not veredicto(i, formas[i], semelhanca, medidas, leituras)]
    print(f"passam: {len(passam)} de {len(formas)}", passam)


if __name__ == "__main__":
    main()
